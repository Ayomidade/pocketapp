'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const uuid = { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true };
    const timestamps = {
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
    };

    await queryInterface.createTable('users', {
      id: uuid,
      github_id: { type: Sequelize.STRING, allowNull: false, unique: true },
      username: { type: Sequelize.STRING, allowNull: false },
      display_name: { type: Sequelize.STRING },
      email: { type: Sequelize.STRING },
      avatar_url: { type: Sequelize.STRING },
      onboarding_completed: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      ...timestamps,
    });

    await queryInterface.createTable('sessions', {
      id: uuid,
      user_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'users', key: 'id' }, onDelete: 'CASCADE' },
      family_id: { type: Sequelize.UUID, allowNull: false },
      refresh_token_hash: { type: Sequelize.STRING, allowNull: false, unique: true },
      device_name: { type: Sequelize.STRING },
      user_agent: { type: Sequelize.STRING },
      ip_address: { type: Sequelize.STRING },
      expires_at: { type: Sequelize.DATE, allowNull: false },
      last_used_at: { type: Sequelize.DATE },
      revoked_at: { type: Sequelize.DATE },
      revoke_reason: { type: Sequelize.STRING },
      ...timestamps,
    });
    await queryInterface.addIndex('sessions', ['user_id', 'family_id']);

    await queryInterface.createTable('oauth_states', {
      id: uuid,
      state: { type: Sequelize.STRING, allowNull: false, unique: true },
      code_verifier: { type: Sequelize.STRING, allowNull: false },
      redirect_uri: { type: Sequelize.STRING, allowNull: false },
      purpose: { type: Sequelize.STRING, allowNull: false, defaultValue: 'login' },
      user_id: { type: Sequelize.UUID, references: { model: 'users', key: 'id' }, onDelete: 'CASCADE' },
      expires_at: { type: Sequelize.DATE, allowNull: false },
      consumed_at: { type: Sequelize.DATE },
      ...timestamps,
    });

    await queryInterface.createTable('github_connections', {
      id: uuid,
      user_id: { type: Sequelize.UUID, allowNull: false, unique: true, references: { model: 'users', key: 'id' }, onDelete: 'CASCADE' },
      github_user_id: { type: Sequelize.STRING, allowNull: false },
      github_login: { type: Sequelize.STRING, allowNull: false },
      encrypted_access_token: { type: Sequelize.TEXT, allowNull: false },
      encrypted_refresh_token: { type: Sequelize.TEXT },
      scopes: { type: Sequelize.STRING, allowNull: false, defaultValue: 'read:user user:email' },
      status: { type: Sequelize.STRING, allowNull: false, defaultValue: 'active' },
      token_expires_at: { type: Sequelize.DATE },
      ...timestamps,
    });

    await queryInterface.createTable('github_installations', {
      id: uuid,
      user_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'users', key: 'id' }, onDelete: 'CASCADE' },
      installation_id: { type: Sequelize.BIGINT, allowNull: false, unique: true },
      account_login: { type: Sequelize.STRING, allowNull: false },
      account_type: { type: Sequelize.STRING, allowNull: false, defaultValue: 'User' },
      repository_selection: { type: Sequelize.STRING, allowNull: false, defaultValue: 'selected' },
      permissions_json: { type: Sequelize.JSONB },
      status: { type: Sequelize.STRING, allowNull: false, defaultValue: 'pending_verification' },
      verified_at: { type: Sequelize.DATE },
      last_synced_at: { type: Sequelize.DATE },
      ...timestamps,
    });
    await queryInterface.addIndex('github_installations', ['user_id']);

    await queryInterface.createTable('authorized_repositories', {
      id: uuid,
      user_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'users', key: 'id' }, onDelete: 'CASCADE' },
      installation_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'github_installations', key: 'id' }, onDelete: 'CASCADE' },
      github_repo_id: { type: Sequelize.BIGINT, allowNull: false },
      full_name: { type: Sequelize.STRING, allowNull: false },
      owner: { type: Sequelize.STRING, allowNull: false },
      name: { type: Sequelize.STRING, allowNull: false },
      default_branch: { type: Sequelize.STRING, allowNull: false, defaultValue: 'main' },
      is_private: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      language: { type: Sequelize.STRING },
      permissions_json: { type: Sequelize.JSONB },
      active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      last_pushed_at: { type: Sequelize.DATE },
      ...timestamps,
    });
    await queryInterface.addIndex('authorized_repositories', ['user_id', 'github_repo_id'], { unique: true });

    await queryInterface.createTable('render_connections', {
      id: uuid,
      user_id: { type: Sequelize.UUID, allowNull: false, unique: true, references: { model: 'users', key: 'id' }, onDelete: 'CASCADE' },
      encrypted_api_key: { type: Sequelize.TEXT, allowNull: false },
      render_owner_id: { type: Sequelize.STRING },
      render_owner_email: { type: Sequelize.STRING },
      render_owner_name: { type: Sequelize.STRING },
      status: { type: Sequelize.STRING, allowNull: false, defaultValue: 'active' },
      last_verified_at: { type: Sequelize.DATE },
      ...timestamps,
    });

    await queryInterface.createTable('projects', {
      id: uuid,
      user_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'users', key: 'id' }, onDelete: 'CASCADE' },
      name: { type: Sequelize.STRING, allowNull: false },
      slug: { type: Sequelize.STRING, allowNull: false },
      description: { type: Sequelize.TEXT },
      environment: { type: Sequelize.STRING, allowNull: false, defaultValue: 'production' },
      ...timestamps,
    });
    await queryInterface.addIndex('projects', ['user_id', 'slug'], { unique: true });

    await queryInterface.createTable('services', {
      id: uuid,
      user_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'users', key: 'id' }, onDelete: 'CASCADE' },
      render_connection_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'render_connections', key: 'id' }, onDelete: 'CASCADE' },
      render_service_id: { type: Sequelize.STRING, allowNull: false },
      name: { type: Sequelize.STRING, allowNull: false },
      service_type: { type: Sequelize.STRING, allowNull: false, defaultValue: 'web_service' },
      repo_full_name: { type: Sequelize.STRING },
      branch: { type: Sequelize.STRING },
      service_url: { type: Sequelize.STRING },
      health_check_path: { type: Sequelize.STRING, allowNull: false, defaultValue: '/health' },
      suspended: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      last_health_status: { type: Sequelize.STRING, allowNull: false, defaultValue: 'unknown' },
      last_health_checked_at: { type: Sequelize.DATE },
      last_latency_ms: { type: Sequelize.INTEGER },
      metadata_json: { type: Sequelize.JSONB },
      ...timestamps,
    });
    await queryInterface.addIndex('services', ['user_id', 'render_service_id'], { unique: true });

    await queryInterface.createTable('project_repositories', {
      id: uuid,
      project_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'projects', key: 'id' }, onDelete: 'CASCADE' },
      repository_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'authorized_repositories', key: 'id' }, onDelete: 'CASCADE' },
      ...timestamps,
    });
    await queryInterface.addIndex('project_repositories', ['project_id', 'repository_id'], { unique: true });

    await queryInterface.createTable('project_services', {
      id: uuid,
      project_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'projects', key: 'id' }, onDelete: 'CASCADE' },
      service_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'services', key: 'id' }, onDelete: 'CASCADE' },
      ...timestamps,
    });
    await queryInterface.addIndex('project_services', ['project_id', 'service_id'], { unique: true });

    await queryInterface.createTable('deployments', {
      id: uuid,
      service_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'services', key: 'id' }, onDelete: 'CASCADE' },
      render_deploy_id: { type: Sequelize.STRING, allowNull: false },
      commit_sha: { type: Sequelize.STRING },
      commit_message: { type: Sequelize.STRING },
      branch: { type: Sequelize.STRING },
      status: { type: Sequelize.STRING, allowNull: false, defaultValue: 'created' },
      trigger_source: { type: Sequelize.STRING, allowNull: false, defaultValue: 'manual' },
      triggered_by_user_id: { type: Sequelize.UUID, references: { model: 'users', key: 'id' }, onDelete: 'SET NULL' },
      started_at: { type: Sequelize.DATE },
      finished_at: { type: Sequelize.DATE },
      ...timestamps,
    });
    await queryInterface.addIndex('deployments', ['service_id', 'render_deploy_id'], { unique: true });

    await queryInterface.createTable('health_checks', {
      id: uuid,
      service_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'services', key: 'id' }, onDelete: 'CASCADE' },
      deployment_id: { type: Sequelize.UUID, references: { model: 'deployments', key: 'id' }, onDelete: 'SET NULL' },
      status: { type: Sequelize.STRING, allowNull: false },
      status_code: { type: Sequelize.INTEGER },
      latency_ms: { type: Sequelize.INTEGER },
      error_message: { type: Sequelize.TEXT },
      source: { type: Sequelize.STRING, allowNull: false, defaultValue: 'scheduled' },
      checked_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
    });
    await queryInterface.addIndex('health_checks', ['service_id', 'checked_at']);

    await queryInterface.createTable('incidents', {
      id: uuid,
      user_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'users', key: 'id' }, onDelete: 'CASCADE' },
      project_id: { type: Sequelize.UUID, references: { model: 'projects', key: 'id' }, onDelete: 'SET NULL' },
      title: { type: Sequelize.STRING, allowNull: false },
      summary: { type: Sequelize.TEXT },
      severity: { type: Sequelize.STRING, allowNull: false, defaultValue: 'P2' },
      status: { type: Sequelize.STRING, allowNull: false, defaultValue: 'open' },
      opened_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      resolved_at: { type: Sequelize.DATE },
      resolution_summary: { type: Sequelize.TEXT },
      verified_check_id: { type: Sequelize.UUID },
      ...timestamps,
    });
    await queryInterface.addIndex('incidents', ['user_id', 'status', 'severity']);

    await queryInterface.createTable('incident_events', {
      id: uuid,
      incident_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'incidents', key: 'id' }, onDelete: 'CASCADE' },
      actor_user_id: { type: Sequelize.UUID, references: { model: 'users', key: 'id' }, onDelete: 'SET NULL' },
      event_type: { type: Sequelize.STRING, allowNull: false },
      message: { type: Sequelize.TEXT, allowNull: false },
      metadata_json: { type: Sequelize.JSONB },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
    });
    await queryInterface.addIndex('incident_events', ['incident_id', 'created_at']);

    await queryInterface.createTable('incident_resources', {
      id: uuid,
      incident_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'incidents', key: 'id' }, onDelete: 'CASCADE' },
      resource_type: { type: Sequelize.STRING, allowNull: false },
      resource_ref: { type: Sequelize.STRING, allowNull: false },
      label: { type: Sequelize.STRING, allowNull: false },
      metadata_json: { type: Sequelize.JSONB },
      ...timestamps,
    });
    await queryInterface.addIndex('incident_resources', ['incident_id', 'resource_type', 'resource_ref'], { unique: true });

    await queryInterface.createTable('notifications', {
      id: uuid,
      user_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'users', key: 'id' }, onDelete: 'CASCADE' },
      event_type: { type: Sequelize.STRING, allowNull: false },
      severity: { type: Sequelize.STRING, allowNull: false, defaultValue: 'info' },
      title: { type: Sequelize.STRING, allowNull: false },
      body: { type: Sequelize.TEXT, allowNull: false },
      deep_link: { type: Sequelize.STRING },
      dedup_key: { type: Sequelize.STRING },
      resource_type: { type: Sequelize.STRING },
      resource_id: { type: Sequelize.STRING },
      delivery_status: { type: Sequelize.STRING, allowNull: false, defaultValue: 'pending' },
      provider_ticket_id: { type: Sequelize.STRING },
      read_at: { type: Sequelize.DATE },
      ...timestamps,
    });
    await queryInterface.addIndex('notifications', ['user_id', 'read_at', 'created_at']);
    await queryInterface.addIndex('notifications', ['user_id', 'dedup_key']);

    await queryInterface.createTable('push_devices', {
      id: uuid,
      user_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'users', key: 'id' }, onDelete: 'CASCADE' },
      expo_push_token: { type: Sequelize.STRING, allowNull: false, unique: true },
      platform: { type: Sequelize.STRING, allowNull: false, defaultValue: 'android' },
      device_name: { type: Sequelize.STRING },
      active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      last_delivered_at: { type: Sequelize.DATE },
      invalid_reason: { type: Sequelize.STRING },
      ...timestamps,
    });

    await queryInterface.createTable('notification_preferences', {
      id: uuid,
      user_id: { type: Sequelize.UUID, allowNull: false, unique: true, references: { model: 'users', key: 'id' }, onDelete: 'CASCADE' },
      incident_alerts: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      deploy_failures: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      health_alerts: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      recovery_alerts: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      pr_check_alerts: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      quiet_hours_enabled: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      quiet_hours_start: { type: Sequelize.STRING, defaultValue: '22:00' },
      quiet_hours_end: { type: Sequelize.STRING, defaultValue: '07:00' },
      ...timestamps,
    });

    await queryInterface.createTable('audit_logs', {
      id: uuid,
      user_id: { type: Sequelize.UUID, references: { model: 'users', key: 'id' }, onDelete: 'SET NULL' },
      action: { type: Sequelize.STRING, allowNull: false },
      resource_type: { type: Sequelize.STRING, allowNull: false },
      resource_id: { type: Sequelize.STRING },
      outcome: { type: Sequelize.STRING, allowNull: false, defaultValue: 'success' },
      ip_address: { type: Sequelize.STRING },
      user_agent: { type: Sequelize.STRING },
      details_json: { type: Sequelize.JSONB },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
    });
    await queryInterface.addIndex('audit_logs', ['user_id', 'created_at']);

    await queryInterface.createTable('idempotency_records', {
      id: uuid,
      user_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'users', key: 'id' }, onDelete: 'CASCADE' },
      idempotency_key: { type: Sequelize.STRING, allowNull: false },
      method: { type: Sequelize.STRING, allowNull: false },
      path: { type: Sequelize.STRING, allowNull: false },
      request_hash: { type: Sequelize.STRING, allowNull: false },
      response_status: { type: Sequelize.INTEGER, allowNull: false },
      response_body_json: { type: Sequelize.JSONB },
      expires_at: { type: Sequelize.DATE, allowNull: false },
      ...timestamps,
    });
    await queryInterface.addIndex('idempotency_records', ['user_id', 'idempotency_key', 'method', 'path'], { unique: true });
  },

  async down(queryInterface) {
    const tables = [
      'idempotency_records', 'audit_logs', 'notification_preferences', 'push_devices',
      'notifications', 'incident_resources', 'incident_events', 'incidents',
      'health_checks', 'deployments', 'project_services', 'project_repositories',
      'services', 'projects', 'render_connections', 'authorized_repositories',
      'github_installations', 'github_connections', 'oauth_states', 'sessions', 'users',
    ];
    for (const t of tables) {
      await queryInterface.dropTable(t);
    }
  },
};
