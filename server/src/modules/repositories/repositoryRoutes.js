const express = require('express');
const { Op } = require('sequelize');
const { z } = require('zod');
const { AuthorizedRepository, GithubInstallation } = require('../../database/models');
const { requireAuth, validateBody } = require('../../middleware/auth');
const { idempotencyMiddleware } = require('../../middleware/idempotency');
const {
  listBranches,
  createBranch,
  getDirectoryContents,
  commitFileWithShaCheck,
  createPullRequest,
  getPullRequestAndChecks,
} = require('../../integrations/githubClient');
const { ForbiddenError, NotFoundError } = require('../../utils/errors');
const { recordAudit } = require('../audit/auditService');

const router = express.Router();
router.use(requireAuth);

async function requireAuthorizedRepo(userId, repoId) {
  const repo = await AuthorizedRepository.findOne({
    where: { id: repoId, userId, active: true },
    include: [{ model: GithubInstallation, as: 'installation' }],
  });
  if (!repo) throw new NotFoundError('Authorized repository not found');
  if (!repo.installation || repo.installation.status !== 'verified') {
    throw new ForbiddenError('GitHub App installation is suspended or unverified', 'INSTALLATION_UNVERIFIED');
  }
  return repo;
}

router.get('/', async (req, res, next) => {
  try {
    const q = String(req.query.q || '').trim();
    const where = { userId: req.user.id, active: true };
    if (q) {
      where.fullName = { [Op.like]: `%${q}%` };
    }
    const repos = await AuthorizedRepository.findAll({
      where,
      order: [['lastPushedAt', 'DESC'], ['fullName', 'ASC']],
    });
    res.json({ repositories: repos });
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const repo = await requireAuthorizedRepo(req.user.id, req.params.id);
    res.json({ repository: repo });
  } catch (err) {
    next(err);
  }
});

router.get('/:id/branches', async (req, res, next) => {
  try {
    const repo = await requireAuthorizedRepo(req.user.id, req.params.id);
    const branches = await listBranches(repo.installation.installationId, repo.owner, repo.name);
    res.json({ branches, defaultBranch: repo.defaultBranch });
  } catch (err) {
    next(err);
  }
});

const createBranchSchema = z.object({
  branchName: z.string().min(1).max(120),
  fromBranch: z.string().min(1),
});

router.post('/:id/branches', validateBody(createBranchSchema), async (req, res, next) => {
  try {
    const repo = await requireAuthorizedRepo(req.user.id, req.params.id);
    const branch = await createBranch(
      repo.installation.installationId,
      repo.owner,
      repo.name,
      req.validatedBody
    );
    await recordAudit({
      userId: req.user.id,
      action: 'git.branch.created',
      resourceType: 'repository',
      resourceId: repo.id,
      details: req.validatedBody,
      req,
    });
    res.status(201).json({ branch });
  } catch (err) {
    next(err);
  }
});

router.get('/:id/contents', async (req, res, next) => {
  try {
    const repo = await requireAuthorizedRepo(req.user.id, req.params.id);
    const path = String(req.query.path || '');
    const ref = String(req.query.ref || repo.defaultBranch);
    const contents = await getDirectoryContents(repo.installation.installationId, repo.owner, repo.name, {
      path,
      ref,
    });
    res.json(contents);
  } catch (err) {
    next(err);
  }
});

const commitSchema = z.object({
  path: z.string().min(1),
  branch: z.string().min(1),
  message: z.string().min(3).max(500),
  content: z.string(),
  expectedSha: z.string().optional(),
});

router.post(
  '/:id/commits',
  idempotencyMiddleware({ required: true }),
  validateBody(commitSchema),
  async (req, res, next) => {
    try {
      const repo = await requireAuthorizedRepo(req.user.id, req.params.id);
      const result = await commitFileWithShaCheck(
        repo.installation.installationId,
        repo.owner,
        repo.name,
        req.validatedBody
      );
      await recordAudit({
        userId: req.user.id,
        action: 'git.commit.created',
        resourceType: 'repository',
        resourceId: repo.id,
        details: { path: req.validatedBody.path, branch: req.validatedBody.branch, commitSha: result.commitSha },
        req,
      });
      res.status(201).json({ commit: result });
    } catch (err) {
      next(err);
    }
  }
);

const createPrSchema = z.object({
  title: z.string().min(3).max(200),
  body: z.string().max(4000).optional().default(''),
  head: z.string().min(1),
  base: z.string().min(1),
});

router.post(
  '/:id/pulls',
  idempotencyMiddleware({ required: true }),
  validateBody(createPrSchema),
  async (req, res, next) => {
    try {
      const repo = await requireAuthorizedRepo(req.user.id, req.params.id);
      const pr = await createPullRequest(
        repo.installation.installationId,
        repo.owner,
        repo.name,
        req.validatedBody
      );
      await recordAudit({
        userId: req.user.id,
        action: 'git.pr.created',
        resourceType: 'repository',
        resourceId: repo.id,
        details: { pullNumber: pr.number, head: pr.head, base: pr.base },
        req,
      });
      res.status(201).json({ pullRequest: pr });
    } catch (err) {
      next(err);
    }
  }
);

router.get('/:id/pulls/:pullNumber', async (req, res, next) => {
  try {
    const repo = await requireAuthorizedRepo(req.user.id, req.params.id);
    const pullRequest = await getPullRequestAndChecks(
      repo.installation.installationId,
      repo.owner,
      repo.name,
      req.params.pullNumber
    );
    res.json({ pullRequest });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
