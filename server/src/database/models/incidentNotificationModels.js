const { DataTypes } = require('sequelize');

module.exports = function defineIncidentNotificationModels(sequelize) {
  const Incident = sequelize.define(
    'Incident',
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      userId: { type: DataTypes.UUID, allowNull: false },
      projectId: { type: DataTypes.UUID, allowNull: true },
      title: { type: DataTypes.STRING, allowNull: false },
      summary: { type: DataTypes.TEXT, allowNull: true },
      severity: { type: DataTypes.ENUM('P1', 'P2', 'P3'), defaultValue: 'P2' },
      status: {
        type: DataTypes.ENUM('open', 'investigating', 'mitigating', 'monitoring', 'resolved'),
        defaultValue: 'open',
      },
      openedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      resolvedAt: { type: DataTypes.DATE, allowNull: true },
      resolutionSummary: { type: DataTypes.TEXT, allowNull: true },
      verifiedCheckId: { type: DataTypes.UUID, allowNull: true },
    },
    { tableName: 'incidents' }
  );

  const IncidentEvent = sequelize.define(
    'IncidentEvent',
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      incidentId: { type: DataTypes.UUID, allowNull: false },
      actorUserId: { type: DataTypes.UUID, allowNull: true },
      eventType: {
        type: DataTypes.ENUM('opened', 'status_change', 'note', 'mitigation', 'resource_linked', 'recovery_verified', 'resolved', 'reopened'),
        allowNull: false,
      },
      message: { type: DataTypes.TEXT, allowNull: false },
      metadataJson: { type: DataTypes.JSON, allowNull: true },
    },
    { tableName: 'incident_events', updatedAt: false }
  );

  const IncidentResource = sequelize.define(
    'IncidentResource',
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      incidentId: { type: DataTypes.UUID, allowNull: false },
      resourceType: {
        type: DataTypes.ENUM('service', 'repository', 'commit', 'pull_request', 'deployment'),
        allowNull: false,
      },
      resourceRef: { type: DataTypes.STRING, allowNull: false },
      label: { type: DataTypes.STRING, allowNull: false },
      metadataJson: { type: DataTypes.JSON, allowNull: true },
    },
    { tableName: 'incident_resources' }
  );

  const Notification = sequelize.define(
    'Notification',
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      userId: { type: DataTypes.UUID, allowNull: false },
      eventType: {
        type: DataTypes.ENUM('incident_alert', 'deploy_failure', 'health_state', 'recovery', 'pr_check', 'integration_alert'),
        allowNull: false,
      },
      severity: { type: DataTypes.ENUM('critical', 'warning', 'info', 'verified'), defaultValue: 'info' },
      title: { type: DataTypes.STRING, allowNull: false },
      body: { type: DataTypes.TEXT, allowNull: false },
      deepLink: { type: DataTypes.STRING, allowNull: true },
      dedupKey: { type: DataTypes.STRING, allowNull: true },
      resourceType: { type: DataTypes.STRING, allowNull: true },
      resourceId: { type: DataTypes.STRING, allowNull: true },
      deliveryStatus: { type: DataTypes.ENUM('pending', 'sent', 'failed', 'skipped'), defaultValue: 'pending' },
      providerTicketId: { type: DataTypes.STRING, allowNull: true },
      readAt: { type: DataTypes.DATE, allowNull: true },
    },
    { tableName: 'notifications' }
  );

  const PushDevice = sequelize.define(
    'PushDevice',
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      userId: { type: DataTypes.UUID, allowNull: false },
      expoPushToken: { type: DataTypes.STRING, allowNull: false, unique: true },
      platform: { type: DataTypes.ENUM('android', 'ios'), defaultValue: 'android' },
      deviceName: { type: DataTypes.STRING, allowNull: true },
      active: { type: DataTypes.BOOLEAN, defaultValue: true },
      lastDeliveredAt: { type: DataTypes.DATE, allowNull: true },
      invalidReason: { type: DataTypes.STRING, allowNull: true },
    },
    { tableName: 'push_devices' }
  );

  const NotificationPreference = sequelize.define(
    'NotificationPreference',
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      userId: { type: DataTypes.UUID, allowNull: false, unique: true },
      incidentAlerts: { type: DataTypes.BOOLEAN, defaultValue: true },
      deployFailures: { type: DataTypes.BOOLEAN, defaultValue: true },
      healthAlerts: { type: DataTypes.BOOLEAN, defaultValue: true },
      recoveryAlerts: { type: DataTypes.BOOLEAN, defaultValue: true },
      prCheckAlerts: { type: DataTypes.BOOLEAN, defaultValue: true },
      quietHoursEnabled: { type: DataTypes.BOOLEAN, defaultValue: false },
      quietHoursStart: { type: DataTypes.STRING, allowNull: true, defaultValue: '22:00' },
      quietHoursEnd: { type: DataTypes.STRING, allowNull: true, defaultValue: '07:00' },
    },
    { tableName: 'notification_preferences' }
  );

  return {
    Incident,
    IncidentEvent,
    IncidentResource,
    Notification,
    PushDevice,
    NotificationPreference,
  };
};
