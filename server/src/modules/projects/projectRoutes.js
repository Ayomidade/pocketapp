const crypto = require('crypto');
const express = require('express');
const { z } = require('zod');
const {
  Project,
  ProjectRepository,
  ProjectService,
  AuthorizedRepository,
  Service,
  Incident,
  Deployment,
} = require('../../database/models');
const { requireAuth, validateBody } = require('../../middleware/auth');
const { NotFoundError } = require('../../utils/errors');

const router = express.Router();
router.use(requireAuth);

router.get('/', async (req, res, next) => {
  try {
    const projects = await Project.findAll({
      where: { userId: req.user.id },
      include: [
        { model: AuthorizedRepository, as: 'repositories', through: { attributes: [] } },
        { model: Service, as: 'services', through: { attributes: [] } },
      ],
      order: [['updatedAt', 'DESC']],
    });
    res.json({ projects });
  } catch (err) {
    next(err);
  }
});

const createProjectSchema = z.object({
  name: z.string().min(2).max(100),
  description: z.string().max(1000).optional().default(''),
  environment: z.enum(['production', 'staging', 'development']).optional().default('production'),
  repositoryIds: z.array(z.string().uuid()).optional().default([]),
  serviceIds: z.array(z.string().uuid()).optional().default([]),
});

router.post('/', validateBody(createProjectSchema), async (req, res, next) => {
  try {
    const { name, description, environment, repositoryIds, serviceIds } = req.validatedBody;
    const slugBase = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'project';
    const slug = `${slugBase}-${crypto.randomBytes(2).toString('hex')}`;

    const project = await Project.create({
      id: crypto.randomUUID(),
      userId: req.user.id,
      name,
      slug,
      description,
      environment,
    });

    for (const repoId of repositoryIds) {
      const repo = await AuthorizedRepository.findOne({ where: { id: repoId, userId: req.user.id } });
      if (repo) {
        await ProjectRepository.create({ id: crypto.randomUUID(), projectId: project.id, repositoryId: repo.id });
      }
    }
    for (const serviceId of serviceIds) {
      const svc = await Service.findOne({ where: { id: serviceId, userId: req.user.id } });
      if (svc) {
        await ProjectService.create({ id: crypto.randomUUID(), projectId: project.id, serviceId: svc.id });
      }
    }

    const hydrated = await Project.findByPk(project.id, {
      include: [
        { model: AuthorizedRepository, as: 'repositories', through: { attributes: [] } },
        { model: Service, as: 'services', through: { attributes: [] } },
      ],
    });
    res.status(201).json({ project: hydrated });
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const project = await Project.findOne({
      where: { id: req.params.id, userId: req.user.id },
      include: [
        { model: AuthorizedRepository, as: 'repositories', through: { attributes: [] } },
        { model: Service, as: 'services', through: { attributes: [] } },
      ],
    });
    if (!project) throw new NotFoundError('Project not found');

    const serviceIds = (project.services || []).map((s) => s.id);
    const [incidents, deployments] = await Promise.all([
      Incident.findAll({ where: { projectId: project.id, userId: req.user.id }, order: [['openedAt', 'DESC']], limit: 10 }),
      serviceIds.length > 0
        ? Deployment.findAll({ where: { serviceId: serviceIds }, order: [['startedAt', 'DESC']], limit: 10 })
        : Promise.resolve([]),
    ]);

    res.json({ project, incidents, recentDeployments: deployments });
  } catch (err) {
    next(err);
  }
});

const linkSchema = z.object({
  repositoryIds: z.array(z.string().uuid()).optional(),
  serviceIds: z.array(z.string().uuid()).optional(),
});

router.put('/:id/links', validateBody(linkSchema), async (req, res, next) => {
  try {
    const project = await Project.findOne({ where: { id: req.params.id, userId: req.user.id } });
    if (!project) throw new NotFoundError('Project not found');

    if (req.validatedBody.repositoryIds) {
      await ProjectRepository.destroy({ where: { projectId: project.id } });
      for (const repoId of req.validatedBody.repositoryIds) {
        const repo = await AuthorizedRepository.findOne({ where: { id: repoId, userId: req.user.id } });
        if (repo) {
          await ProjectRepository.create({ id: crypto.randomUUID(), projectId: project.id, repositoryId: repo.id });
        }
      }
    }
    if (req.validatedBody.serviceIds) {
      await ProjectService.destroy({ where: { projectId: project.id } });
      for (const serviceId of req.validatedBody.serviceIds) {
        const svc = await Service.findOne({ where: { id: serviceId, userId: req.user.id } });
        if (svc) {
          await ProjectService.create({ id: crypto.randomUUID(), projectId: project.id, serviceId: svc.id });
        }
      }
    }

    const hydrated = await Project.findByPk(project.id, {
      include: [
        { model: AuthorizedRepository, as: 'repositories', through: { attributes: [] } },
        { model: Service, as: 'services', through: { attributes: [] } },
      ],
    });
    res.json({ project: hydrated });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
