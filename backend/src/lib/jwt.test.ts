import { describe, it, expect } from 'vitest';
import { signToken, verifyToken } from './jwt.js';

const SECRET = 'test-secret';

describe('jwt', () => {
  it('signs and verifies a token roundtrip', async () => {
    const expiresAt = Date.now() + 60 * 60 * 1000;
    const token = await signToken({ sessionId: 's1', userId: 'u1', role: 'ADMIN' }, SECRET, expiresAt);
    const payload = await verifyToken(token, SECRET);
    expect(payload).toEqual({ sessionId: 's1', userId: 'u1', role: 'ADMIN' });
  });

  it('rejects a token signed with a different secret', async () => {
    const expiresAt = Date.now() + 60 * 60 * 1000;
    const token = await signToken({ sessionId: 's1', userId: 'u1', role: 'USER' }, SECRET, expiresAt);
    await expect(verifyToken(token, 'other-secret')).rejects.toThrow();
  });

  it('rejects an expired token', async () => {
    const token = await signToken({ sessionId: 's1', userId: 'u1', role: 'USER' }, SECRET, Date.now() - 1000);
    await expect(verifyToken(token, SECRET)).rejects.toThrow();
  });
});
