const { sequelize } = require('../index');
const defineAuthModels = require('./authModels');
const defineIntegrationModels = require('./integrationModels');
const defineOpsModels = require('./opsModels');
const defineIncidentNotificationModels = require('./incidentNotificationModels');

function initModels(db = sequelize) {
  const auth = defineAuthModels(db);
  const integrations = defineIntegrationModels(db);
  const ops = defineOpsModels(db);
  const inc = defineIncidentNotificationModels(db);

  const models = { ...auth, ...integrations, ...ops, ...inc };

  // User associations
  models.User.hasMany(models.Session, { foreignKey: 'userId', as: 'sessions' });
  models.Session.belongsTo(models.User, { foreignKey: 'userId', as: 'user' });

  models.User.hasOne(models.GithubConnection, { foreignKey: 'userId', as: 'githubConnection' });
  models.GithubConnection.belongsTo(models.User, { foreignKey: 'userId', as: 'user' });

  models.User.hasMany(models.GithubInstallation, { foreignKey: 'userId', as: 'githubInstallations' });
  models.GithubInstallation.belongsTo(models.User, { foreignKey: 'userId', as: 'user' });

  models.GithubInstallation.hasMany(models.AuthorizedRepository, {
    foreignKey: 'installationId',
    as: 'repositories',
  });
  models.AuthorizedRepository.belongsTo(models.GithubInstallation, {
    foreignKey: 'installationId',
    as: 'installation',
  });

  models.User.hasOne(models.RenderConnection, { foreignKey: 'userId', as: 'renderConnection' });
  models.RenderConnection.belongsTo(models.User, { foreignKey: 'userId', as: 'user' });

  // Projects <-> Repositories & Services
  models.User.hasMany(models.Project, { foreignKey: 'userId', as: 'projects' });
  models.Project.belongsTo(models.User, { foreignKey: 'userId', as: 'user' });

  models.Project.belongsToMany(models.AuthorizedRepository, {
    through: models.ProjectRepository,
    foreignKey: 'projectId',
    otherKey: 'repositoryId',
    as: 'repositories',
  });
  models.AuthorizedRepository.belongsToMany(models.Project, {
    through: models.ProjectRepository,
    foreignKey: 'repositoryId',
    otherKey: 'projectId',
    as: 'projects',
  });

  models.Project.belongsToMany(models.Service, {
    through: models.ProjectService,
    foreignKey: 'projectId',
    otherKey: 'serviceId',
    as: 'services',
  });
  models.Service.belongsToMany(models.Project, {
    through: models.ProjectService,
    foreignKey: 'serviceId',
    otherKey: 'projectId',
    as: 'projects',
  });

  // Services -> Deployments & HealthChecks
  models.Service.belongsTo(models.User, { foreignKey: 'userId', as: 'user' });
  models.Service.belongsTo(models.RenderConnection, { foreignKey: 'renderConnectionId', as: 'renderConnection' });
  models.Service.hasMany(models.Deployment, { foreignKey: 'serviceId', as: 'deployments' });
  models.Deployment.belongsTo(models.Service, { foreignKey: 'serviceId', as: 'service' });
  models.Service.hasMany(models.HealthCheck, { foreignKey: 'serviceId', as: 'healthChecks' });
  models.HealthCheck.belongsTo(models.Service, { foreignKey: 'serviceId', as: 'service' });

  // Incidents -> Events & Linked Resources
  models.User.hasMany(models.Incident, { foreignKey: 'userId', as: 'incidents' });
  models.Incident.belongsTo(models.User, { foreignKey: 'userId', as: 'user' });
  models.Incident.belongsTo(models.Project, { foreignKey: 'projectId', as: 'project' });
  models.Incident.hasMany(models.IncidentEvent, { foreignKey: 'incidentId', as: 'events' });
  models.IncidentEvent.belongsTo(models.Incident, { foreignKey: 'incidentId', as: 'incident' });
  models.Incident.hasMany(models.IncidentResource, { foreignKey: 'incidentId', as: 'resources' });
  models.IncidentResource.belongsTo(models.Incident, { foreignKey: 'incidentId', as: 'incident' });

  // Notifications & Devices
  models.User.hasMany(models.Notification, { foreignKey: 'userId', as: 'notifications' });
  models.Notification.belongsTo(models.User, { foreignKey: 'userId', as: 'user' });
  models.User.hasMany(models.PushDevice, { foreignKey: 'userId', as: 'pushDevices' });
  models.PushDevice.belongsTo(models.User, { foreignKey: 'userId', as: 'user' });
  models.User.hasOne(models.NotificationPreference, { foreignKey: 'userId', as: 'notificationPreference' });
  models.NotificationPreference.belongsTo(models.User, { foreignKey: 'userId', as: 'user' });

  return { sequelize: db, ...models };
}

const initialized = initModels(sequelize);

module.exports = {
  ...initialized,
  initModels,
};
