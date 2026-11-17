// Exercise the installation handoff without contacting GitHub or altering a database.
process.env.NODE_ENV = 'development';
process.env.LOG_LEVEL = 'silent';
const jwt = require('jsonwebtoken');
const request = require('supertest');
const env = require('../src/config/env');
const models = require('../src/database/models');
const github = require('../src/integrations/githubClient');
const { encryptSecret } = require('../src/utils/crypto');

const states = new Map();
models.OAuthState.create = async (state) => { states.set(state.state, { ...state }); return state; };
models.OAuthState.findOne = async ({ where }) => {
  const state = states.get(where.state);
  if (!state || (where.userId && state.userId !== where.userId) || (where.purpose && state.purpose !== where.purpose) || (where.consumedAt === null && state.consumedAt)) return null;
  return state;
};
models.OAuthState.update = async (values, { where }) => {
  const state = [...states.values()].find((item) => item.id === where.id && !item.consumedAt);
  if (!state) return [0];
  Object.assign(state, values);
  return [1];
};
models.GithubConnection.findOne = async () => ({ status: 'active', encryptedAccessToken: encryptSecret('test-provider-token') });
models.GithubInstallation.findOrCreate = async () => [{ id: 'installation-local-id', accountLogin: 'test', status: 'verified', installationId: 12345, update: async () => {} }];
models.AuditLog.create = async () => ({});
github.verifyAndFetchInstallation = async () => ({ installationId: 12345, accountLogin: 'test', accountType: 'User', repositorySelection: 'selected', permissions: {} });
github.listInstallationRepositories = async () => [];
const { createApp } = require('../src/app');
const app = createApp();
const token = jwt.sign({ sub: 'test-user', sid: 'test-session' }, env.JWT_ACCESS_SECRET);
const auth = { Authorization: `Bearer ${token}` };

describe('GitHub installation handoff', () => {
  it('validates state, returns to the app, and rejects a replay', async () => {
    const start = await request(app).post('/api/v1/integrations/github/install-url').set(auth).send({});
    expect(start.status).toBe(200);
    expect(states.get(start.body.state).userId).toBe('test-user');
    const callback = await request(app).get('/api/v1/github/installations/callback').query({ installation_id: '12345', state: start.body.state });
    expect(callback.status).toBe(302);
    const target = new URL(callback.headers.location);
    expect(`${target.protocol}//${target.host}${target.pathname}`).toBe('pocketops://github/install');
    expect(target.searchParams.get('installation_id')).toBe('12345');
    const verify = await request(app).post('/api/v1/integrations/github/installations/verify').set(auth).send({ installationId: 12345, state: start.body.state });
    expect(verify.status).toBe(200);
    const replay = await request(app).post('/api/v1/integrations/github/installations/verify').set(auth).send({ installationId: 12345, state: start.body.state });
    expect(replay.status).toBe(400);
  });
  it('does not redirect an expired or invalid state to the app', async () => {
    const start = await request(app).post('/api/v1/integrations/github/install-url').set(auth).send({});
    states.get(start.body.state).expiresAt = new Date(Date.now() - 1000);
    const callback = await request(app).get('/api/v1/github/installations/callback').query({ installation_id: '12345', state: start.body.state });
    expect(callback.status).toBe(200);
    expect(callback.headers.location).toBeUndefined();
    const invalidId = await request(app).get('/api/v1/github/installations/callback').query({ installation_id: '<script>' });
    expect(invalidId.status).toBe(400);
  });
});
