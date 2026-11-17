const crypto = require('crypto');
const express = require('express');
const { Op } = require('sequelize');
const { z } = require('zod');
const {
  Project,
  ProjectRepository,
  ProjectService,
  AuthorizedRepository,
  Service,
  Incident,
  Deployment,
  AuditLog,
  sequelize,
} = require('../../database/models');
const { requireAuth, validateBody } = require('../../middleware/auth');
const { BadRequestError, NotFoundError } = require('../../utils/errors');
const { recordAudit } = require('../audit/auditService');

const router = express.Router();
router.use(requireAuth);

async function validateLinks(userId, repositoryIds = [], serviceIds = [], transaction) {
  const repoIds = [...new Set(repositoryIds)];
  const svcIds = [...new Set(serviceIds)];
  const [repos, services] = await Promise.all([
    repoIds.length ? AuthorizedRepository.findAll({ where: { id: repoIds, userId, active: true }, transaction }) : [],
    svcIds.length ? Service.findAll({ where: { id: svcIds, userId }, transaction }) : [],
  ]);
  if (repos.length !== repoIds.length || services.length !== svcIds.length) throw new BadRequestError('One or more selected resources are unavailable. Refresh and try again.');
  return { repos, services };
}

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

    const project = await sequelize.transaction(async (transaction) => {
      const { repos, services } = await validateLinks(req.user.id, repositoryIds, serviceIds, transaction);
      const row = await Project.create({
      id: crypto.randomUUID(),
      userId: req.user.id,
      name,
      slug,
      description,
      environment,
      }, { transaction });
      for (const repo of repos) await ProjectRepository.create({ id: crypto.randomUUID(), projectId: row.id, repositoryId: repo.id }, { transaction });
      for (const svc of services) await ProjectService.create({ id: crypto.randomUUID(), projectId: row.id, serviceId: svc.id }, { transaction });
      return row;
    });

    const hydrated = await Project.findByPk(project.id, {
      include: [
        { model: AuthorizedRepository, as: 'repositories', through: { attributes: [] } },
        { model: Service, as: 'services', through: { attributes: [] } },
      ],
    });
    await recordAudit({ userId: req.user.id, action: 'project.created', resourceType: 'project', resourceId: project.id, req });
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
    const [incidents, deployments, projectIncidentIds] = await Promise.all([
      Incident.findAll({ where: { projectId: project.id, userId: req.user.id }, order: [['openedAt', 'DESC']], limit: 10 }),
      serviceIds.length > 0
        ? Deployment.findAll({ where: { serviceId: serviceIds }, order: [['startedAt', 'DESC']], limit: 10 })
        : Promise.resolve([]),
      Incident.findAll({ attributes: ['id'], where: { projectId: project.id, userId: req.user.id } }),
    ]);

    const scopes = [
      { resourceType: 'project', resourceId: project.id },
      ...((project.repositories || []).length ? [{ resourceType: 'repository', resourceId: (project.repositories || []).map((repo) => repo.id) }] : []),
      ...(serviceIds.length ? [{ resourceType: 'service', resourceId: serviceIds }] : []),
      ...(projectIncidentIds.length ? [{ resourceType: 'incident', resourceId: projectIncidentIds.map((incident) => incident.id) }] : []),
    ];
    const activity = await AuditLog.findAll({
      attributes: ['id', 'action', 'resourceType', 'resourceId', 'outcome', 'createdAt'],
      where: { userId: req.user.id, [Op.or]: scopes },
      order: [['createdAt', 'DESC']], limit: 50,
    });
    res.json({ project, incidents, recentDeployments: deployments, activity });
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

    await sequelize.transaction(async (transaction) => {
      const { repos, services } = await validateLinks(req.user.id, req.validatedBody.repositoryIds, req.validatedBody.serviceIds, transaction);
      if (req.validatedBody.repositoryIds) {
        await ProjectRepository.destroy({ where: { projectId: project.id }, transaction });
        for (const repo of repos) await ProjectRepository.create({ id: crypto.randomUUID(), projectId: project.id, repositoryId: repo.id }, { transaction });
      }
      if (req.validatedBody.serviceIds) {
        await ProjectService.destroy({ where: { projectId: project.id }, transaction });
        for (const svc of services) await ProjectService.create({ id: crypto.randomUUID(), projectId: project.id, serviceId: svc.id }, { transaction });
      }
    });

    const hydrated = await Project.findByPk(project.id, {
      include: [
        { model: AuthorizedRepository, as: 'repositories', through: { attributes: [] } },
        { model: Service, as: 'services', through: { attributes: [] } },
      ],
    });
    await recordAudit({ userId: req.user.id, action: 'project.links.updated', resourceType: 'project', resourceId: project.id, req });
    res.json({ project: hydrated });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
