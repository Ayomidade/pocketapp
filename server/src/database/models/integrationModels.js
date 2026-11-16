const { DataTypes } = require('sequelize');

module.exports = function defineIntegrationModels(sequelize) {
  const GithubConnection = sequelize.define(
    'GithubConnection',
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      userId: { type: DataTypes.UUID, allowNull: false, unique: true },
      githubUserId: { type: DataTypes.STRING, allowNull: false },
      githubLogin: { type: DataTypes.STRING, allowNull: false },
      encryptedAccessToken: { type: DataTypes.TEXT, allowNull: false },
      encryptedRefreshToken: { type: DataTypes.TEXT, allowNull: true },
      scopes: { type: DataTypes.STRING, allowNull: false, defaultValue: 'read:user user:email' },
      status: { type: DataTypes.ENUM('active', 'expired', 'revoked'), defaultValue: 'active' },
      tokenExpiresAt: { type: DataTypes.DATE, allowNull: true },
    },
    { tableName: 'github_connections' }
  );

  const GithubInstallation = sequelize.define(
    'GithubInstallation',
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      userId: { type: DataTypes.UUID, allowNull: false },
      installationId: { type: DataTypes.BIGINT, allowNull: false, unique: true },
      accountLogin: { type: DataTypes.STRING, allowNull: false },
      accountType: { type: DataTypes.ENUM('User', 'Organization'), defaultValue: 'User' },
      repositorySelection: { type: DataTypes.ENUM('all', 'selected'), defaultValue: 'selected' },
      permissionsJson: { type: DataTypes.JSON, allowNull: true },
      status: {
        type: DataTypes.ENUM('pending_verification', 'verified', 'suspended', 'removed'),
        defaultValue: 'pending_verification',
      },
      verifiedAt: { type: DataTypes.DATE, allowNull: true },
      lastSyncedAt: { type: DataTypes.DATE, allowNull: true },
    },
    { tableName: 'github_installations' }
  );

  const AuthorizedRepository = sequelize.define(
    'AuthorizedRepository',
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      userId: { type: DataTypes.UUID, allowNull: false },
      installationId: { type: DataTypes.UUID, allowNull: false },
      githubRepoId: { type: DataTypes.BIGINT, allowNull: false },
      fullName: { type: DataTypes.STRING, allowNull: false },
      owner: { type: DataTypes.STRING, allowNull: false },
      name: { type: DataTypes.STRING, allowNull: false },
      defaultBranch: { type: DataTypes.STRING, allowNull: false, defaultValue: 'main' },
      isPrivate: { type: DataTypes.BOOLEAN, defaultValue: true },
      language: { type: DataTypes.STRING, allowNull: true },
      permissionsJson: { type: DataTypes.JSON, allowNull: true },
      active: { type: DataTypes.BOOLEAN, defaultValue: true },
      lastPushedAt: { type: DataTypes.DATE, allowNull: true },
    },
    { tableName: 'authorized_repositories' }
  );

  const RenderConnection = sequelize.define(
    'RenderConnection',
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      userId: { type: DataTypes.UUID, allowNull: false, unique: true },
      encryptedApiKey: { type: DataTypes.TEXT, allowNull: false },
      renderOwnerId: { type: DataTypes.STRING, allowNull: true },
      renderOwnerEmail: { type: DataTypes.STRING, allowNull: true },
      renderOwnerName: { type: DataTypes.STRING, allowNull: true },
      status: { type: DataTypes.ENUM('active', 'invalid', 'revoked'), defaultValue: 'active' },
      lastVerifiedAt: { type: DataTypes.DATE, allowNull: true },
    },
    { tableName: 'render_connections' }
  );

  return {
    GithubConnection,
    GithubInstallation,
    AuthorizedRepository,
    RenderConnection,
  };
};
