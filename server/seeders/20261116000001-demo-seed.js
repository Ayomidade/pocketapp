'use strict';

const crypto = require('crypto');

module.exports = {
  async up(queryInterface) {
    const now = new Date();
    const userId = '11111111-1111-4111-8111-111111111111';
    const projectId = '22222222-2222-4222-8222-222222222222';

    await queryInterface.bulkInsert('users', [
      {
        id: userId,
        github_id: 'dev-seed-1001',
        username: 'pocketops-dev',
        display_name: 'PocketOps Engineer',
        email: 'engineer@pocketops.dev',
        avatar_url: 'https://avatars.githubusercontent.com/u/9919?v=4',
        onboarding_completed: true,
        created_at: now,
        updated_at: now,
      },
    ]);

    await queryInterface.bulkInsert('notification_preferences', [
      {
        id: crypto.randomUUID(),
        user_id: userId,
        incident_alerts: true,
        deploy_failures: true,
        health_alerts: true,
        recovery_alerts: true,
        pr_check_alerts: true,
        quiet_hours_enabled: false,
        quiet_hours_start: '22:00',
        quiet_hours_end: '07:00',
        created_at: now,
        updated_at: now,
      },
    ]);

    await queryInterface.bulkInsert('projects', [
      {
        id: projectId,
        user_id: userId,
        name: 'Checkout Core',
        slug: 'checkout-core',
        description: 'Primary production checkout API and webhook worker',
        environment: 'production',
        created_at: now,
        updated_at: now,
      },
    ]);
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('projects', { slug: 'checkout-core' });
    await queryInterface.bulkDelete('users', { github_id: 'dev-seed-1001' });
  },
};
