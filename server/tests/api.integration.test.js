process.env.NODE_ENV = 'test';
process.env.GITHUB_WEBHOOK_SECRET = 'test_webhook_secret';

const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const request = require('supertest');

const env = require('../src/config/env');
const { sequelize, User, Session, RenderConnection, Service, AuditLog, GithubConnection, GithubInstallation, AuthorizedRepository } = require('../src/database/models');
const { saveGithubConnection } = require('../src/modules/auth/githubConnection');
const { createApp } = require('../src/app');
const { sha256Hex } = require('../src/utils/crypto');

describe('PocketOps API v1 Integration Suite', () => {
  let app;
  let user;
  let accessToken;
  let rawRefreshToken;

  beforeAll(async () => {
    await sequelize.sync({ force: true });
    app = createApp();

    user = await User.create({
      id: crypto.randomUUID(),
      githubId: 'gh-9901',
      username: 'relay-ops',
      displayName: 'Relay OnCall',
      email: 'oncall@pocketops.dev',
      onboardingCompleted: true,
    });

    const sessionId = crypto.randomUUID();
    const familyId = crypto.randomUUID();
    rawRefreshToken = `${sessionId}.test_refresh_secret_value`;

    await Session.create({
      id: sessionId,
      userId: user.id,
      familyId,
      refreshTokenHash: sha256Hex(rawRefreshToken),
      deviceName: 'Pixel 9 Pro',
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });

    accessToken = jwt.sign(
      { sub: user.id, sid: sessionId, username: user.username },
      env.JWT_ACCESS_SECRET,
      { expiresIn: '15m' }
    );
  });

  afterAll(async () => {
    await sequelize.close();
  });

  it('returns /health and rejects unauthenticated requests cleanly', async () => {
    const health = await request(app).get('/health');
    expect(health.status).toBe(200);
    expect(health.body.status).toBe('ok');

    const unauth = await request(app).get('/api/v1/projects');
    expect(unauth.status).toBe(401);
    expect(unauth.body.error.code).toBe('UNAUTHORIZED');
  });

  it('updates the existing GitHub connection on repeated sign-in', async () => {
    const values = { githubUserId: '123', githubLogin: 'relay-ops', encryptedAccessToken: 'first', scopes: 'read:user', status: 'active' };
    const first = await saveGithubConnection(user.id, values);
    const second = await saveGithubConnection(user.id, { ...values, encryptedAccessToken: 'second' });
    expect(second.id).toBe(first.id);
    expect(await GithubConnection.count({ where: { userId: user.id } })).toBe(1);
    expect(second.encryptedAccessToken).toBe('second');
  });

  it('distinguishes inaccessible repository states without exposing another user’s repository', async () => {
    const installation = await GithubInstallation.create({ id: crypto.randomUUID(), userId: user.id, installationId: 998877, accountLogin: 'relay-ops', status: 'verified' });
    const repo = await AuthorizedRepository.create({ id: crypto.randomUUID(), userId: user.id, installationId: installation.id, githubRepoId: 42, fullName: 'relay-ops/example', owner: 'relay-ops', name: 'example', active: false });
    const getRepo = (id) => request(app).get(`/api/v1/repositories/${id}`).set('Authorization', `Bearer ${accessToken}`);
    expect((await getRepo(repo.id)).body.error.code).toBe('REPOSITORY_ACCESS_REVOKED');
    await installation.update({ status: 'suspended' });
    expect((await getRepo(repo.id)).body.error.code).toBe('INSTALLATION_UNVERIFIED');
    expect((await getRepo(crypto.randomUUID())).body.error.code).toBe('REPOSITORY_NOT_FOUND');
  });

  it('rejects unavailable project links without removing existing links', async () => {
    const connection = await RenderConnection.create({ id: crypto.randomUUID(), userId: user.id, encryptedApiKey: 'test' });
    const service = await Service.create({ id: crypto.randomUUID(), userId: user.id, renderConnectionId: connection.id, renderServiceId: 'test-service', name: 'Test service' });
    const created = await request(app).post('/api/v1/projects').set('Authorization', `Bearer ${accessToken}`).send({ name: 'Linked project', serviceIds: [service.id] });
    expect(created.status).toBe(201);
    const projectId = created.body.project.id;
    expect(created.body.project.services).toHaveLength(1);
    const rejected = await request(app).put(`/api/v1/projects/${projectId}/links`).set('Authorization', `Bearer ${accessToken}`).send({ serviceIds: [crypto.randomUUID()] });
    expect(rejected.status).toBe(400);
    const current = await request(app).get(`/api/v1/projects/${projectId}`).set('Authorization', `Bearer ${accessToken}`);
    expect(current.body.project.services.map((item) => item.id)).toContain(service.id);
    await AuditLog.create({ id: crypto.randomUUID(), userId: user.id, action: 'service.test', resourceType: 'service', resourceId: service.id, outcome: 'success' });
    await AuditLog.create({ id: crypto.randomUUID(), userId: user.id, action: 'unrelated.test', resourceType: 'service', resourceId: crypto.randomUUID(), outcome: 'success' });
    const otherUser = await User.create({ id: crypto.randomUUID(), githubId: 'gh-other', username: 'other-user' });
    await AuditLog.create({ id: crypto.randomUUID(), userId: otherUser.id, action: 'other-user.test', resourceType: 'service', resourceId: service.id, outcome: 'success' });
    const withActivity = await request(app).get(`/api/v1/projects/${projectId}`).set('Authorization', `Bearer ${accessToken}`);
    expect(withActivity.body.activity.map((item) => item.action)).toEqual(expect.arrayContaining(['project.created', 'service.test']));
    expect(withActivity.body.activity.map((item) => item.action)).not.toEqual(expect.arrayContaining(['unrelated.test', 'other-user.test']));
    const badCreate = await request(app).post('/api/v1/projects').set('Authorization', `Bearer ${accessToken}`).send({ name: 'Invalid links', repositoryIds: [crypto.randomUUID()] });
    expect(badCreate.status).toBe(400);
  });

  it('rotates refresh tokens and revokes entire session family on replay reuse', async () => {
    const firstRefresh = await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: rawRefreshToken });

    expect(firstRefresh.status).toBe(200);
    expect(firstRefresh.body.accessToken).toBeTruthy();
    expect(firstRefresh.body.refreshToken).not.toBe(rawRefreshToken);

    // Replaying the already-rotated refresh token must fail and revoke family
    const replay = await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: rawRefreshToken });
    expect(replay.status).toBe(401);
    expect(replay.body.error.code).toBe('SESSION_COMPROMISED');

    // Even the newly rotated token from the same compromised family is now rejected
    const compromised = await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: firstRefresh.body.refreshToken });
    expect(compromised.status).toBe(401);
  });

  it('manages projects, full incident lifecycle, idempotent resolution, and audit logs', async () => {
    const projectRes = await request(app)
      .post('/api/v1/projects')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: 'Payments API', environment: 'production' });
    expect(projectRes.status).toBe(201);
    const projectId = projectRes.body.project.id;

    // Create incident (also persists notification & audit log)
    const incRes = await request(app)
      .post('/api/v1/incidents')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        title: '502 Bad Gateway on /webhooks/stripe',
        severity: 'P1',
        projectId,
        resources: [
          { resourceType: 'repository', resourceRef: 'acme/payments-api', label: 'acme/payments-api' },
        ],
      });
    expect(incRes.status).toBe(201);
    const incidentId = incRes.body.incident.id;

    // Lifecycle transitions
    const inv = await request(app)
      .post(`/api/v1/incidents/${incidentId}/status`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ status: 'investigating', message: 'Inspecting Render runtime logs' });
    expect(inv.status).toBe(200);

    // Requires explicit confirmation + Idempotency-Key to resolve
    const noKey = await request(app)
      .post(`/api/v1/incidents/${incidentId}/resolve`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ confirmResolution: true, resolutionSummary: 'Rolled forward null check fix' });
    expect(noKey.status).toBe(400);

    const idemKey = crypto.randomUUID();
    const resolved = await request(app)
      .post(`/api/v1/incidents/${incidentId}/resolve`)
      .set('Authorization', `Bearer ${accessToken}`)
      .set('Idempotency-Key', idemKey)
      .send({ confirmResolution: true, resolutionSummary: 'Rolled forward null check fix' });
    expect(resolved.status).toBe(200);
    expect(resolved.body.incident.status).toBe('resolved');

    // Replay same Idempotency-Key returns cached 200 without duplicating resolution event
    const replayResolved = await request(app)
      .post(`/api/v1/incidents/${incidentId}/resolve`)
      .set('Authorization', `Bearer ${accessToken}`)
      .set('Idempotency-Key', idemKey)
      .send({ confirmResolution: true, resolutionSummary: 'Rolled forward null check fix' });
    expect(replayResolved.status).toBe(200);

    // Notifications persisted independently in inbox
    const notifRes = await request(app)
      .get('/api/v1/ops/notifications')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(notifRes.status).toBe(200);
    expect(notifRes.body.notifications.length).toBeGreaterThanOrEqual(2);

    // Audit history recorded
    const auditRes = await request(app)
      .get('/api/v1/ops/audit')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(auditRes.status).toBe(200);
    expect(auditRes.body.auditLogs.some((a) => a.action === 'incident.resolved')).toBe(true);
  });

  it('rejects invalid GitHub webhook signatures and accepts valid HMAC-SHA256 webhooks', async () => {
    const payload = JSON.stringify({ action: 'created', installation: { id: 555 } });

    const bad = await request(app)
      .post('/api/v1/webhooks/github')
      .set('Content-Type', 'application/json')
      .set('X-GitHub-Event', 'installation')
      .set('X-Hub-Signature-256', 'sha256=invalid')
      .send(payload);
    expect(bad.status).toBe(401);

    const sig = `sha256=${crypto
      .createHmac('sha256', process.env.GITHUB_WEBHOOK_SECRET)
      .update(payload)
      .digest('hex')}`;

    const good = await request(app)
      .post('/api/v1/webhooks/github')
      .set('Content-Type', 'application/json')
      .set('X-GitHub-Event', 'installation')
      .set('X-Hub-Signature-256', sig)
      .send(payload);
    expect(good.status).toBe(202);
    expect(good.body.accepted).toBe(true);
  });
});
