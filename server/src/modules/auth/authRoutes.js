const crypto = require('crypto');
const express = require('express');
const jwt = require('jsonwebtoken');
const { z } = require('zod');
const env = require('../../config/env');
const { User, Session, OAuthState, NotificationPreference } = require('../../database/models');
const { saveGithubConnection } = require('./githubConnection');
const { encryptSecret, sha256Hex, generatePkcePair, generateStateToken } = require('../../utils/crypto');
const {
  buildGithubOAuthAuthorizeUrl,
  exchangeGithubOAuthCode,
  fetchGithubAuthenticatedUser,
} = require('../../integrations/githubClient');
const { requireAuth, validateBody } = require('../../middleware/auth');
const { BadRequestError, UnauthorizedError, NotFoundError } = require('../../utils/errors');
const { recordAudit } = require('../audit/auditService');

const router = express.Router();

function issueTokenPair(user, sessionId) {
  const accessToken = jwt.sign(
    { sub: user.id, sid: sessionId, username: user.username },
    env.JWT_ACCESS_SECRET,
    { expiresIn: env.JWT_ACCESS_TTL }
  );
  const rawRefreshToken = `${sessionId}.${crypto.randomBytes(32).toString('base64url')}`;
  return { accessToken, rawRefreshToken };
}

const startSchema = z.object({
  redirectUri: z.string().optional(),
  deviceName: z.string().max(120).optional(),
});

router.post('/github/start', validateBody(startSchema), async (req, res, next) => {
  try {
    const state = generateStateToken();
    const { codeVerifier, codeChallenge } = generatePkcePair();
    const redirectUri = req.validatedBody.redirectUri || `${env.MOBILE_DEEP_LINK_SCHEME}://auth/callback`;

    await OAuthState.create({
      id: crypto.randomUUID(),
      state,
      codeVerifier,
      redirectUri,
      purpose: 'login',
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    });

    const authorizeUrl = buildGithubOAuthAuthorizeUrl({
      state,
      codeChallenge,
      redirectUri: env.GITHUB_OAUTH_CALLBACK_URL,
    });

    res.json({ authorizeUrl, state });
  } catch (err) {
    next(err);
  }
});

// Browser callback from GitHub -> hands off short-lived one-time code or renders deep-link redirect
router.get('/github/callback', async (req, res, next) => {
  try {
    const { code, state, error, error_description: errorDescription } = req.query;
    if (error) {
      return res.redirect(
        `${env.MOBILE_DEEP_LINK_SCHEME}://auth/callback?error=${encodeURIComponent(error)}&error_description=${encodeURIComponent(errorDescription || '')}`
      );
    }
    if (!code || !state) {
      throw new BadRequestError('Missing code or state parameter');
    }

    const oauthState = await OAuthState.findOne({ where: { state: String(state) } });
    if (!oauthState || oauthState.consumedAt || new Date(oauthState.expiresAt) < new Date()) {
      throw new UnauthorizedError('Invalid or expired OAuth state parameter', 'INVALID_OAUTH_STATE');
    }

    const target = new URL(oauthState.redirectUri);
    target.searchParams.set('code', String(code));
    target.searchParams.set('state', String(state));
    return res.redirect(target.toString());
  } catch (err) {
    return next(err);
  }
});

const exchangeSchema = z.object({
  code: z.string().min(1),
  state: z.string().min(1),
  deviceName: z.string().max(120).optional(),
});

router.post('/github/exchange', validateBody(exchangeSchema), async (req, res, next) => {
  try {
    const { code, state, deviceName } = req.validatedBody;
    const oauthState = await OAuthState.findOne({ where: { state } });
    if (!oauthState || oauthState.consumedAt || new Date(oauthState.expiresAt) < new Date()) {
      throw new UnauthorizedError('OAuth state invalid, expired, or already consumed', 'OAUTH_STATE_REPLAY');
    }

    await oauthState.update({ consumedAt: new Date() });

    const tokenPayload = await exchangeGithubOAuthCode({
      code,
      codeVerifier: oauthState.codeVerifier,
      redirectUri: env.GITHUB_OAUTH_CALLBACK_URL,
    });
    const ghUser = await fetchGithubAuthenticatedUser(tokenPayload.access_token);

    let [user] = await User.findOrCreate({
      where: { githubId: ghUser.githubId },
      defaults: {
        id: crypto.randomUUID(),
        githubId: ghUser.githubId,
        username: ghUser.username,
        displayName: ghUser.displayName,
        email: ghUser.email,
        avatarUrl: ghUser.avatarUrl,
      },
    });
    await user.update({
      username: ghUser.username,
      displayName: ghUser.displayName,
      email: ghUser.email,
      avatarUrl: ghUser.avatarUrl,
    });

    await saveGithubConnection(user.id, {
      githubUserId: ghUser.githubId,
      githubLogin: ghUser.username,
      encryptedAccessToken: encryptSecret(tokenPayload.access_token),
      encryptedRefreshToken: tokenPayload.refresh_token ? encryptSecret(tokenPayload.refresh_token) : null,
      scopes: tokenPayload.scope || 'read:user user:email',
      status: 'active',
    });

    await NotificationPreference.findOrCreate({
      where: { userId: user.id },
      defaults: { id: crypto.randomUUID(), userId: user.id },
    });

    const sessionId = crypto.randomUUID();
    const familyId = crypto.randomUUID();
    const { accessToken, rawRefreshToken } = issueTokenPair(user, sessionId);

    await Session.create({
      id: sessionId,
      userId: user.id,
      familyId,
      refreshTokenHash: sha256Hex(rawRefreshToken),
      deviceName: deviceName || 'Mobile Device',
      userAgent: req.headers['user-agent'] || null,
      ipAddress: req.ip,
      expiresAt: new Date(Date.now() + env.JWT_REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000),
      lastUsedAt: new Date(),
    });

    await recordAudit({
      userId: user.id,
      action: 'auth.github.login',
      resourceType: 'session',
      resourceId: sessionId,
      req,
    });

    res.json({
      accessToken,
      refreshToken: rawRefreshToken,
      user: {
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        email: user.email,
        avatarUrl: user.avatarUrl,
        onboardingCompleted: user.onboardingCompleted,
      },
    });
  } catch (err) {
    next(err);
  }
});

const refreshSchema = z.object({
  refreshToken: z.string().min(10),
});

router.post('/refresh', validateBody(refreshSchema), async (req, res, next) => {
  try {
    const tokenHash = sha256Hex(req.validatedBody.refreshToken);
    const existing = await Session.findOne({ where: { refreshTokenHash: tokenHash } });
    if (!existing) {
      throw new UnauthorizedError('Invalid refresh token', 'INVALID_REFRESH_TOKEN');
    }

    // Replay detection: if a rotated/revoked token is reused, revoke the entire family
    if (existing.revokedAt) {
      await Session.update(
        { revokedAt: new Date(), revokeReason: 'refresh_token_reuse_detected' },
        { where: { familyId: existing.familyId, revokedAt: null } }
      );
      await recordAudit({
        userId: existing.userId,
        action: 'auth.refresh.replay_detected',
        resourceType: 'session_family',
        resourceId: existing.familyId,
        outcome: 'denied',
        req,
      });
      throw new UnauthorizedError('Refresh token replay detected; session family revoked', 'SESSION_COMPROMISED');
    }

    if (new Date(existing.expiresAt) < new Date()) {
      throw new UnauthorizedError('Refresh token expired', 'REFRESH_EXPIRED');
    }

    const user = await User.findByPk(existing.userId);
    if (!user) throw new UnauthorizedError('User no longer exists');

    await existing.update({ revokedAt: new Date(), revokeReason: 'rotated' });

    const newSessionId = crypto.randomUUID();
    const { accessToken, rawRefreshToken } = issueTokenPair(user, newSessionId);

    await Session.create({
      id: newSessionId,
      userId: user.id,
      familyId: existing.familyId,
      refreshTokenHash: sha256Hex(rawRefreshToken),
      deviceName: existing.deviceName,
      userAgent: req.headers['user-agent'] || existing.userAgent,
      ipAddress: req.ip,
      expiresAt: new Date(Date.now() + env.JWT_REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000),
      lastUsedAt: new Date(),
    });

    res.json({ accessToken, refreshToken: rawRefreshToken });
  } catch (err) {
    next(err);
  }
});

router.get('/me', requireAuth, async (req, res, next) => {
  try {
    const user = await User.findByPk(req.user.id);
    if (!user) throw new NotFoundError('User not found');
    res.json({
      user: {
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        email: user.email,
        avatarUrl: user.avatarUrl,
        onboardingCompleted: user.onboardingCompleted,
      },
    });
  } catch (err) {
    next(err);
  }
});

router.patch('/me/onboarding', requireAuth, async (req, res, next) => {
  try {
    const user = await User.findByPk(req.user.id);
    if (!user) throw new NotFoundError('User not found');
    await user.update({ onboardingCompleted: true });
    res.json({ onboardingCompleted: true });
  } catch (err) {
    next(err);
  }
});

router.get('/sessions', requireAuth, async (req, res, next) => {
  try {
    const sessions = await Session.findAll({
      where: { userId: req.user.id, revokedAt: null },
      order: [['createdAt', 'DESC']],
    });
    res.json({
      sessions: sessions.map((s) => ({
        id: s.id,
        deviceName: s.deviceName,
        ipAddress: s.ipAddress,
        current: s.id === req.user.sessionId,
        lastUsedAt: s.lastUsedAt,
        createdAt: s.createdAt,
        expiresAt: s.expiresAt,
      })),
    });
  } catch (err) {
    next(err);
  }
});

router.delete('/sessions/:id', requireAuth, async (req, res, next) => {
  try {
    const session = await Session.findOne({ where: { id: req.params.id, userId: req.user.id } });
    if (!session) throw new NotFoundError('Session not found');
    await session.update({ revokedAt: new Date(), revokeReason: 'user_revoked' });
    await recordAudit({
      userId: req.user.id,
      action: 'auth.session.revoked',
      resourceType: 'session',
      resourceId: session.id,
      req,
    });
    res.json({ revoked: true });
  } catch (err) {
    next(err);
  }
});

router.post('/logout', requireAuth, async (req, res, next) => {
  try {
    await Session.update(
      { revokedAt: new Date(), revokeReason: 'logout' },
      { where: { id: req.user.sessionId, userId: req.user.id } }
    );
    await recordAudit({
      userId: req.user.id,
      action: 'auth.logout',
      resourceType: 'session',
      resourceId: req.user.sessionId,
      req,
    });
    res.json({ loggedOut: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
