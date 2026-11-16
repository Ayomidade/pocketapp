const { Octokit } = require('octokit');
const { createAppAuth } = require('@octokit/auth-app');
const env = require('../config/env');
const { ConflictError, UpstreamError, BadRequestError } = require('../utils/errors');

function normalizePrivateKey(raw) {
  return raw ? raw.replace(/\\n/g, '\n') : '';
}

function buildGithubOAuthAuthorizeUrl({ state, codeChallenge, redirectUri }) {
  if (!env.GITHUB_CLIENT_ID) {
    throw new BadRequestError('GITHUB_CLIENT_ID is not configured on the backend', null, 'GITHUB_OAUTH_UNCONFIGURED');
  }
  const params = new URLSearchParams({
    client_id: env.GITHUB_CLIENT_ID,
    redirect_uri: redirectUri || env.GITHUB_OAUTH_CALLBACK_URL,
    scope: 'read:user user:email',
    state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
  });
  return `https://github.com/login/oauth/authorize?${params.toString()}`;
}

async function exchangeGithubOAuthCode({ code, codeVerifier, redirectUri }) {
  if (!env.GITHUB_CLIENT_ID || !env.GITHUB_CLIENT_SECRET) {
    throw new BadRequestError('GitHub OAuth credentials are not configured', null, 'GITHUB_OAUTH_UNCONFIGURED');
  }

  const res = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      client_id: env.GITHUB_CLIENT_ID,
      client_secret: env.GITHUB_CLIENT_SECRET,
      code,
      code_verifier: codeVerifier,
      redirect_uri: redirectUri || env.GITHUB_OAUTH_CALLBACK_URL,
    }),
  });

  if (!res.ok) {
    throw new UpstreamError('GitHub OAuth token exchange failed', { status: res.status });
  }
  const data = await res.json();
  if (data.error || !data.access_token) {
    throw new UpstreamError(data.error_description || 'GitHub OAuth returned an error', data);
  }
  return data;
}

async function fetchGithubAuthenticatedUser(accessToken) {
  const octokit = new Octokit({ auth: accessToken });
  const { data: user } = await octokit.rest.users.getAuthenticated();
  let primaryEmail = user.email;
  if (!primaryEmail) {
    try {
      const { data: emails } = await octokit.rest.users.listEmailsForAuthenticatedUser();
      primaryEmail = (emails.find((e) => e.primary) || emails[0])?.email || null;
    } catch {
      primaryEmail = null;
    }
  }
  return {
    githubId: String(user.id),
    username: user.login,
    displayName: user.name || user.login,
    email: primaryEmail,
    avatarUrl: user.avatar_url,
  };
}

function getAppOctokit(installationId) {
  const privateKey = normalizePrivateKey(env.GITHUB_APP_PRIVATE_KEY);
  if (!env.GITHUB_APP_ID || !privateKey) {
    throw new BadRequestError('GitHub App credentials are not configured on the backend', null, 'GITHUB_APP_UNCONFIGURED');
  }
  if (installationId) {
    return new Octokit({
      authStrategy: createAppAuth,
      auth: {
        appId: env.GITHUB_APP_ID,
        privateKey,
        installationId: Number(installationId),
      },
    });
  }
  return new Octokit({
    authStrategy: createAppAuth,
    auth: {
      appId: env.GITHUB_APP_ID,
      privateKey,
    },
  });
}

function buildGithubAppInstallUrl(state) {
  const slug = env.GITHUB_APP_SLUG || 'pocketops-relay';
  const params = state ? `?state=${encodeURIComponent(state)}` : '';
  return `https://github.com/apps/${slug}/installations/new${params}`;
}

async function verifyAndFetchInstallation(installationId, userAccessToken) {
  // Verify user actually has access to this installation via OAuth user token
  const userOctokit = new Octokit({ auth: userAccessToken });
  const { data: userInstalls } = await userOctokit.rest.apps.listInstallationsForAuthenticatedUser({
    per_page: 100,
  });
  const owned = userInstalls.installations.find((inst) => Number(inst.id) === Number(installationId));
  if (!owned) {
    throw new ConflictError('GitHub App installation is not accessible to the authenticated GitHub user');
  }

  return {
    installationId: owned.id,
    accountLogin: owned.account?.login || 'unknown',
    accountType: owned.account?.type === 'Organization' ? 'Organization' : 'User',
    repositorySelection: owned.repository_selection === 'all' ? 'all' : 'selected',
    permissions: owned.permissions || {},
  };
}

async function listInstallationRepositories(installationId) {
  const octokit = getAppOctokit(installationId);
  const { data } = await octokit.rest.apps.listReposAccessibleToInstallation({ per_page: 100 });
  return data.repositories.map((r) => ({
    githubRepoId: r.id,
    fullName: r.full_name,
    owner: r.owner.login,
    name: r.name,
    defaultBranch: r.default_branch,
    isPrivate: Boolean(r.private),
    language: r.language,
    permissions: r.permissions || {},
    lastPushedAt: r.pushed_at ? new Date(r.pushed_at) : null,
  }));
}

async function listBranches(installationId, owner, repo) {
  const octokit = getAppOctokit(installationId);
  const { data } = await octokit.rest.repos.listBranches({ owner, repo, per_page: 100 });
  return data.map((b) => ({
    name: b.name,
    sha: b.commit.sha,
    protected: Boolean(b.protected),
  }));
}

async function createBranch(installationId, owner, repo, { branchName, fromBranch }) {
  const octokit = getAppOctokit(installationId);
  const { data: baseRef } = await octokit.rest.git.getRef({
    owner,
    repo,
    ref: `heads/${fromBranch}`,
  });
  const { data: created } = await octokit.rest.git.createRef({
    owner,
    repo,
    ref: `refs/heads/${branchName}`,
    sha: baseRef.object.sha,
  });
  return { name: branchName, sha: created.object.sha, baseBranch: fromBranch };
}

async function getDirectoryContents(installationId, owner, repo, { path = '', ref }) {
  const octokit = getAppOctokit(installationId);
  const { data } = await octokit.rest.repos.getContent({
    owner,
    repo,
    path,
    ref,
  });
  if (!Array.isArray(data)) {
    return {
      kind: 'file',
      file: {
        name: data.name,
        path: data.path,
        sha: data.sha,
        size: data.size,
        encoding: data.encoding,
        content: data.encoding === 'base64' ? Buffer.from(data.content, 'base64').toString('utf8') : data.content,
      },
    };
  }
  return {
    kind: 'dir',
    entries: data
      .map((item) => ({
        name: item.name,
        path: item.path,
        type: item.type,
        sha: item.sha,
        size: item.size || 0,
      }))
      .sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name) : a.type === 'dir' ? -1 : 1)),
  };
}

async function commitFileWithShaCheck(installationId, owner, repo, { path, branch, message, content, expectedSha }) {
  const octokit = getAppOctokit(installationId);
  // Explicit remote SHA verification to prevent silent overwrites
  if (expectedSha) {
    try {
      const { data: current } = await octokit.rest.repos.getContent({ owner, repo, path, ref: branch });
      if (!Array.isArray(current) && current.sha !== expectedSha) {
        throw new ConflictError(
          'Remote file was modified since you opened it',
          {
            expectedSha,
            remoteSha: current.sha,
            remoteContent:
              current.encoding === 'base64' ? Buffer.from(current.content, 'base64').toString('utf8') : current.content,
          },
          'REMOTE_REVISION_CONFLICT'
        );
      }
    } catch (err) {
      if (err instanceof ConflictError) throw err;
      if (err.status !== 404) throw err;
    }
  }

  const { data } = await octokit.rest.repos.createOrUpdateFileContents({
    owner,
    repo,
    path,
    branch,
    message,
    content: Buffer.from(content, 'utf8').toString('base64'),
    sha: expectedSha || undefined,
  });

  return {
    commitSha: data.commit.sha,
    commitUrl: data.commit.html_url,
    fileSha: data.content?.sha,
    path: data.content?.path || path,
    branch,
  };
}

async function createPullRequest(installationId, owner, repo, { title, body, head, base }) {
  const octokit = getAppOctokit(installationId);
  const { data } = await octokit.rest.pulls.create({
    owner,
    repo,
    title,
    body,
    head,
    base,
  });
  return {
    number: data.number,
    title: data.title,
    state: data.state,
    head: data.head.ref,
    base: data.base.ref,
    headSha: data.head.sha,
    htmlUrl: data.html_url,
    mergeableState: data.mergeable_state,
  };
}

async function getPullRequestAndChecks(installationId, owner, repo, pullNumber) {
  const octokit = getAppOctokit(installationId);
  const [{ data: pr }, { data: checks }] = await Promise.all([
    octokit.rest.pulls.get({ owner, repo, pull_number: Number(pullNumber) }),
    octokit.rest.pulls
      .get({ owner, repo, pull_number: Number(pullNumber) })
      .then(({ data }) => octokit.rest.checks.listForRef({ owner, repo, ref: data.head.sha })),
  ]);

  return {
    number: pr.number,
    title: pr.title,
    body: pr.body,
    state: pr.state,
    merged: pr.merged,
    head: pr.head.ref,
    base: pr.base.ref,
    headSha: pr.head.sha,
    htmlUrl: pr.html_url,
    checks: (checks.check_runs || []).map((c) => ({
      id: c.id,
      name: c.name,
      status: c.status,
      conclusion: c.conclusion,
      startedAt: c.started_at,
      completedAt: c.completed_at,
      detailsUrl: c.details_url,
    })),
  };
}

module.exports = {
  buildGithubOAuthAuthorizeUrl,
  exchangeGithubOAuthCode,
  fetchGithubAuthenticatedUser,
  buildGithubAppInstallUrl,
  verifyAndFetchInstallation,
  listInstallationRepositories,
  listBranches,
  createBranch,
  getDirectoryContents,
  commitFileWithShaCheck,
  createPullRequest,
  getPullRequestAndChecks,
};
