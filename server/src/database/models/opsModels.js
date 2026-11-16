const { DataTypes } = require('sequelize');

module.exports = function defineOpsModels(sequelize) {
  const Project = sequelize.define(
    'Project',
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      userId: { type: DataTypes.UUID, allowNull: false },
      name: { type: DataTypes.STRING, allowNull: false },
      slug: { type: DataTypes.STRING, allowNull: false },
      description: { type: DataTypes.TEXT, allowNull: true },
      environment: { type: DataTypes.ENUM('production', 'staging', 'development'), defaultValue: 'production' },
    },
    { tableName: 'projects' }
  );

  const ProjectRepository = sequelize.define(
    'ProjectRepository',
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      projectId: { type: DataTypes.UUID, allowNull: false },
      repositoryId: { type: DataTypes.UUID, allowNull: false },
    },
    { tableName: 'project_repositories' }
  );

  const Service = sequelize.define(
    'Service',
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      userId: { type: DataTypes.UUID, allowNull: false },
      renderConnectionId: { type: DataTypes.UUID, allowNull: false },
      renderServiceId: { type: DataTypes.STRING, allowNull: false },
      name: { type: DataTypes.STRING, allowNull: false },
      serviceType: { type: DataTypes.STRING, allowNull: false, defaultValue: 'web_service' },
      repoFullName: { type: DataTypes.STRING, allowNull: true },
      branch: { type: DataTypes.STRING, allowNull: true },
      serviceUrl: { type: DataTypes.STRING, allowNull: true },
      healthCheckPath: { type: DataTypes.STRING, allowNull: false, defaultValue: '/health' },
      suspended: { type: DataTypes.BOOLEAN, defaultValue: false },
      lastHealthStatus: {
        type: DataTypes.ENUM('healthy', 'degraded', 'unhealthy', 'checking', 'stale', 'unknown'),
        defaultValue: 'unknown',
      },
      lastHealthCheckedAt: { type: DataTypes.DATE, allowNull: true },
      lastLatencyMs: { type: DataTypes.INTEGER, allowNull: true },
      metadataJson: { type: DataTypes.JSON, allowNull: true },
    },
    { tableName: 'services' }
  );

  const ProjectService = sequelize.define(
    'ProjectService',
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      projectId: { type: DataTypes.UUID, allowNull: false },
      serviceId: { type: DataTypes.UUID, allowNull: false },
    },
    { tableName: 'project_services' }
  );

  const Deployment = sequelize.define(
    'Deployment',
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      serviceId: { type: DataTypes.UUID, allowNull: false },
      renderDeployId: { type: DataTypes.STRING, allowNull: false },
      commitSha: { type: DataTypes.STRING, allowNull: true },
      commitMessage: { type: DataTypes.STRING, allowNull: true },
      branch: { type: DataTypes.STRING, allowNull: true },
      status: {
        type: DataTypes.ENUM('created', 'build_in_progress', 'update_in_progress', 'live', 'deactivated', 'build_failed', 'update_failed', 'canceled'),
        defaultValue: 'created',
      },
      triggerSource: { type: DataTypes.ENUM('manual', 'webhook', 'auto_deploy'), defaultValue: 'manual' },
      triggeredByUserId: { type: DataTypes.UUID, allowNull: true },
      startedAt: { type: DataTypes.DATE, allowNull: true },
      finishedAt: { type: DataTypes.DATE, allowNull: true },
    },
    { tableName: 'deployments' }
  );

  const HealthCheck = sequelize.define(
    'HealthCheck',
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      serviceId: { type: DataTypes.UUID, allowNull: false },
      deploymentId: { type: DataTypes.UUID, allowNull: true },
      status: {
        type: DataTypes.ENUM('healthy', 'degraded', 'unhealthy', 'checking', 'stale', 'unknown'),
        allowNull: false,
      },
      statusCode: { type: DataTypes.INTEGER, allowNull: true },
      latencyMs: { type: DataTypes.INTEGER, allowNull: true },
      errorMessage: { type: DataTypes.TEXT, allowNull: true },
      source: { type: DataTypes.ENUM('scheduled', 'manual', 'post_deploy'), defaultValue: 'scheduled' },
      checkedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    },
    { tableName: 'health_checks', updatedAt: false }
  );

  return {
    Project,
    ProjectRepository,
    ProjectService,
    Service,
    Deployment,
    HealthCheck,
  };
};
