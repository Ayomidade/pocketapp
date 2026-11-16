const crypto = require('crypto');
const express = require('express');
const { z } = require('zod');
const {
  GithubConnection,
  GithubInstallation,
  AuthorizedRepository,
  RenderConnection,
} = require('../../database/models');
const { requireAuth, validateBody } = require('../../middleware/auth');
const { encryptSecret, decryptSecret, generateStateToken } = require('../../utils/crypto');
const {
  buildGithubAppInstallUrl,
  verifyAndFetchInstallation,
  listInstallationRepositories,
} = require('../../integrations/githubClient');
const { verifyRenderApiKey } = require('../../integrations/renderClient');
const { BadRequestError, NotFoundError } = require('../../utils/errors');
const { recordAudit } = require('../audit/auditService');

const router = express.Router();
router.use(requireAuth);

router.get('/overview', async (req, res, next) => {
  try {
    const [githubConn, installations, renderConn, repoCount] = await Promise.all([
      GithubConnection.findOne({ where: { userId: req.user.id } }),
      GithubInstallation.findAll({ where: { userId: req.user.id }, order: [['createdAt', 'DESC']] }),
      RenderConnection.findOne({ where: { userId: req.user.id } }),
      AuthorizedRepository.count({ where: { userId: req.user.id, active: true } }),
    ]);

    res.json({
      githubOAuth: githubConn
        ? {
            connected: githubConn.status === 'active',
            status: githubConn.status,
            login: githubConn.githubLogin,
            scopes: githubConn.scopes,
          }
        : { connected: false, status: 'disconnected' },
      githubInstallations: installations.map((i) => ({
        id: i.id,
        installationId: Number(i.installationId),
        accountLogin: i.accountLogin,
        accountType: i.accountType,
        repositorySelection: i.repositorySelection,
        status: i.status,
        verifiedAt: i.verifiedAt,
        lastSyncedAt: i.lastSyncedAt,
      })),
      authorizedRepositoryCount: repoCount,
      render: renderConn
        ? {
            connected: renderConn.status === 'active',
            status: renderConn.status,
            ownerEmail: renderConn.renderOwnerEmail,
            ownerName: renderConn.renderOwnerName,
            lastVerifiedAt: renderConn.lastVerifiedAt,
          }
        : { connected: false, status: 'disconnected' },
    });
  } catch (err) {
    next(err);
  }
});

router.post('/github/install-url', async (req, res, next) => {
  try {
    const state = generateStateToken();
    res.json({ installUrl: buildGithubAppInstallUrl(state), state });
  } catch (err) {
    next(err);
  }
});

const verifyInstallSchema = z.object({
  installationId: z.coerce.number().int().positive(),
});

router.post('/github/installations/verify', validateBody(verifyInstallSchema), async (req, res, next) => {
  try {
    const githubConn = await GithubConnection.findOne({ where: { userId: req.user.id } });
    if (!githubConn || githubConn.status !== 'active') {
      throw new BadRequestError('Active GitHub OAuth connection is required before verifying an installation');
    }
    const userAccessToken = decryptSecret(githubConn.encryptedAccessToken);
    const verified = await verifyAndFetchInstallation(req.validatedBody.installationId, userAccessToken);

    const [installation] = await GithubInstallation.findOrCreate({
      where: { installationId: verified.installationId },
      defaults: {
        id: crypto.randomUUID(),
        userId: req.user.id,
        installationId: verified.installationId,
        accountLogin: verified.accountLogin,
        accountType: verified.accountType,
        repositorySelection: verified.repositorySelection,
        permissionsJson: verified.permissions,
        status: 'verified',
        verifiedAt: new Date(),
      },
    });

    await installation.update({
      userId: req.user.id,
      accountLogin: verified.accountLogin,
      accountType: verified.accountType,
      repositorySelection: verified.repositorySelection,
      permissionsJson: verified.permissions,
      status: 'verified',
      verifiedAt: new Date(),
    });

    const repos = await listInstallationRepositories(verified.installationId);
    for (const r of repos) {
      const [repoRow] = await AuthorizedRepository.findOrCreate({
        where: { userId: req.user.id, githubRepoId: r.githubRepoId },
        defaults: {
          id: crypto.randomUUID(),
          userId: req.user.id,
          installationId: installation.id,
          ...r,
          permissionsJson: r.permissions,
          active: true,
        },
      });
      await repoRow.update({
        installationId: installation.id,
        fullName: r.fullName,
        owner: r.owner,
        name: r.name,
        defaultBranch: r.defaultBranch,
        isPrivate: r.isPrivate,
        language: r.language,
        permissionsJson: r.permissions,
        active: true,
        lastPushedAt: r.lastPushedAt,
      });
    }
    await installation.update({ lastSyncedAt: new Date() });

    await recordAudit({
      userId: req.user.id,
      action: 'github.installation.verified',
      resourceType: 'github_installation',
      resourceId: installation.id,
      details: { installationId: verified.installationId, repoCount: repos.length },
      req,
    });

    res.json({
      installation: {
        id: installation.id,
        installationId: Number(installation.installationId),
        accountLogin: installation.accountLogin,
        status: installation.status,
      },
      syncedRepositories: repos.length,
    });
  } catch (err) {
    next(err);
  }
});

router.post('/github/installations/:id/sync', async (req, res, next) => {
  try {
    const installation = await GithubInstallation.findOne({
      where: { id: req.params.id, userId: req.user.id },
    });
    if (!installation) throw new NotFoundError('GitHub App installation not found');
    if (installation.status !== 'verified') {
      throw new BadRequestError('Installation must be verified before syncing repositories');
    }

    const repos = await listInstallationRepositories(installation.installationId);
    const activeRepoIds = new Set(repos.map((r) => Number(r.githubRepoId)));

    const existingRepos = await AuthorizedRepository.findAll({ where: { installationId: installation.id } });
    for (const ex of existingRepos) {
      if (!activeRepoIds.has(Number(ex.githubRepoId))) {
        await ex.update({ active: false });
      }
    }

    for (const r of repos) {
      const [row] = await AuthorizedRepository.findOrCreate({
        where: { userId: req.user.id, githubRepoId: r.githubRepoId },
        defaults: {
          id: crypto.randomUUID(),
          userId: req.user.id,
          installationId: installation.id,
          ...r,
          permissionsJson: r.permissions,
          active: true,
        },
      });
      await row.update({
        defaultBranch: r.defaultBranch,
        permissionsJson: r.permissions,
        active: true,
        lastPushedAt: r.lastPushedAt,
      });
    }

    await installation.update({ lastSyncedAt: new Date() });
    res.json({ synced: repos.length, lastSyncedAt: installation.lastSyncedAt });
  } catch (err) {
    next(err);
  }
});

router.delete('/github/installations/:id', async (req, res, next) => {
  try {
    const installation = await GithubInstallation.findOne({
      where: { id: req.params.id, userId: req.user.id },
    });
    if (!installation) throw new NotFoundError('GitHub App installation not found');
    await AuthorizedRepository.update({ active: false }, { where: { installationId: installation.id } });
    await installation.update({ status: 'removed' });
    await recordAudit({
      userId: req.user.id,
      action: 'github.installation.removed',
      resourceType: 'github_installation',
      resourceId: installation.id,
      req,
    });
    res.json({ removed: true });
  } catch (err) {
    next(err);
  }
});

const renderConnectSchema = z.object({
  apiKey: z.string().min(10, 'Render API key is required'),
});

router.post('/render/connect', validateBody(renderConnectSchema), async (req, res, next) => {
  try {
    const owner = await verifyRenderApiKey(req.validatedBody.apiKey);
    const existing = await RenderConnection.findOne({ where: { userId: req.user.id } });
    const encryptedApiKey = encryptSecret(req.validatedBody.apiKey);

    let connection;
    if (existing) {
      connection = await existing.update({
        encryptedApiKey,
        renderOwnerId: owner.ownerId,
        renderOwnerEmail: owner.ownerEmail,
        renderOwnerName: owner.ownerName,
        status: 'active',
        lastVerifiedAt: new Date(),
      });
    } else {
      connection = await RenderConnection.create({
        id: crypto.randomUUID(),
        userId: req.user.id,
        encryptedApiKey,
        renderOwnerId: owner.ownerId,
        renderOwnerEmail: owner.ownerEmail,
        renderOwnerName: owner.ownerName,
        status: 'active',
        lastVerifiedAt: new Date(),
      });
    }

    await recordAudit({
      userId: req.user.id,
      action: 'render.connection.verified',
      resourceType: 'render_connection',
      resourceId: connection.id,
      req,
    });

    res.json({
      connected: true,
      ownerEmail: connection.renderOwnerEmail,
      ownerName: connection.renderOwnerName,
      lastVerifiedAt: connection.lastVerifiedAt,
    });
  } catch (err) {
    next(err);
  }
});

router.delete('/render', async (req, res, next) => {
  try {
    const conn = await RenderConnection.findOne({ where: { userId: req.user.id } });
    if (!conn) throw new NotFoundError('No Render connection found');
    await conn.update({ status: 'revoked', encryptedApiKey: '' });
    await recordAudit({
      userId: req.user.id,
      action: 'render.connection.disconnected',
      resourceType: 'render_connection',
      resourceId: conn.id,
      req,
    });
    res.json({ disconnected: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
