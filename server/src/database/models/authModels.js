const { DataTypes } = require('sequelize');

module.exports = function defineAuthModels(sequelize) {
  const User = sequelize.define(
    'User',
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      githubId: { type: DataTypes.STRING, allowNull: false, unique: true },
      username: { type: DataTypes.STRING, allowNull: false },
      displayName: { type: DataTypes.STRING, allowNull: true },
      email: { type: DataTypes.STRING, allowNull: true },
      avatarUrl: { type: DataTypes.STRING, allowNull: true },
      onboardingCompleted: { type: DataTypes.BOOLEAN, defaultValue: false },
    },
    { tableName: 'users' }
  );

  const Session = sequelize.define(
    'Session',
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      userId: { type: DataTypes.UUID, allowNull: false },
      familyId: { type: DataTypes.UUID, allowNull: false },
      refreshTokenHash: { type: DataTypes.STRING, allowNull: false, unique: true },
      deviceName: { type: DataTypes.STRING, allowNull: true },
      userAgent: { type: DataTypes.STRING, allowNull: true },
      ipAddress: { type: DataTypes.STRING, allowNull: true },
      expiresAt: { type: DataTypes.DATE, allowNull: false },
      lastUsedAt: { type: DataTypes.DATE, allowNull: true },
      revokedAt: { type: DataTypes.DATE, allowNull: true },
      revokeReason: { type: DataTypes.STRING, allowNull: true },
    },
    { tableName: 'sessions' }
  );

  const OAuthState = sequelize.define(
    'OAuthState',
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      state: { type: DataTypes.STRING, allowNull: false, unique: true },
      codeVerifier: { type: DataTypes.STRING, allowNull: false },
      redirectUri: { type: DataTypes.STRING, allowNull: false },
      purpose: { type: DataTypes.ENUM('login', 'github_install'), defaultValue: 'login' },
      userId: { type: DataTypes.UUID, allowNull: true },
      expiresAt: { type: DataTypes.DATE, allowNull: false },
      consumedAt: { type: DataTypes.DATE, allowNull: true },
    },
    { tableName: 'oauth_states' }
  );

  const AuditLog = sequelize.define(
    'AuditLog',
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      userId: { type: DataTypes.UUID, allowNull: true },
      action: { type: DataTypes.STRING, allowNull: false },
      resourceType: { type: DataTypes.STRING, allowNull: false },
      resourceId: { type: DataTypes.STRING, allowNull: true },
      outcome: { type: DataTypes.ENUM('success', 'failure', 'denied'), defaultValue: 'success' },
      ipAddress: { type: DataTypes.STRING, allowNull: true },
      userAgent: { type: DataTypes.STRING, allowNull: true },
      detailsJson: { type: DataTypes.JSON, allowNull: true },
    },
    { tableName: 'audit_logs', updatedAt: false }
  );

  const IdempotencyRecord = sequelize.define(
    'IdempotencyRecord',
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      userId: { type: DataTypes.UUID, allowNull: false },
      idempotencyKey: { type: DataTypes.STRING, allowNull: false },
      method: { type: DataTypes.STRING, allowNull: false },
      path: { type: DataTypes.STRING, allowNull: false },
      requestHash: { type: DataTypes.STRING, allowNull: false },
      responseStatus: { type: DataTypes.INTEGER, allowNull: false },
      responseBodyJson: { type: DataTypes.JSON, allowNull: true },
      expiresAt: { type: DataTypes.DATE, allowNull: false },
    },
    { tableName: 'idempotency_records' }
  );

  return { User, Session, OAuthState, AuditLog, IdempotencyRecord };
};
