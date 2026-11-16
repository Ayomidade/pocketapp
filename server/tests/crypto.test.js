const crypto = require('crypto');
const {
  encryptSecret,
  decryptSecret,
  generatePkcePair,
  verifyGithubSignature,
} = require('../src/utils/crypto');

describe('Security & Cryptography Utilities', () => {
  it('encrypts and decrypts provider secrets via AES-256-GCM', () => {
    const secret = 'rnd_live_secret_token_987654';
    const encrypted = encryptSecret(secret);
    expect(encrypted).not.toContain(secret);
    expect(encrypted.split('.')).toHaveLength(3);
    expect(decryptSecret(encrypted)).toBe(secret);
  });

  it('generates valid S256 PKCE verifier and challenge pairs', () => {
    const { codeVerifier, codeChallenge } = generatePkcePair();
    const recomputed = crypto.createHash('sha256').update(codeVerifier).digest('base64url');
    expect(codeChallenge).toBe(recomputed);
  });

  it('verifies valid GitHub HMAC-SHA256 webhook signatures and rejects tampered payloads', () => {
    const secret = 'whsec_test_123';
    const body = JSON.stringify({ action: 'created', installation: { id: 42 } });
    const sig = `sha256=${crypto.createHmac('sha256', secret).update(body).digest('hex')}`;

    expect(verifyGithubSignature(body, sig, secret)).toBe(true);
    expect(verifyGithubSignature(`${body} `, sig, secret)).toBe(false);
    expect(verifyGithubSignature(body, 'sha256=deadbeef', secret)).toBe(false);
  });
});
