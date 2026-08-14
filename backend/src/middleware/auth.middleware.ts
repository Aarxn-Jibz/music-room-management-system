import { MiddlewareHandler } from 'hono';
import { verifyToken, JWTPayload } from '../lib/jwt.js';
import { getDb } from '../db/client.js';
import { DrizzleAuthRepository } from '../features/auth/auth.repository.js';
import { User } from '../db/repositories/users.repository.js';
import { Session } from '../db/repositories/sessions.repository.js';
import { resolveJwtSecret } from '../config/index.js';

export interface AppEnv {
  Bindings: {
    DB: D1Database;
    JWT_SECRET: string;
    ENV?: string;
    SMTP_HOST?: string;
    SMTP_PORT?: string;
    SMTP_USER?: string;
    SMTP_PASSWORD?: string;
  };
  Variables: {
    user: User;
    session: Session;
    jwtPayload: JWTPayload;
  };
}

export const requireAuth = (): MiddlewareHandler<AppEnv> => {
  return async (c, next) => {
    const cookies = c.req.header('cookie') || '';
    const match = cookies.match(/(?:^|;)\s*token\s*=\s*([^;]+)/);
    const token = match ? decodeURIComponent(match[1]) : null;

    if (!token) {
      return c.json({ error: 'Unauthorized: No token provided' }, 401);
    }

    const jwtSecret = resolveJwtSecret(c.env.JWT_SECRET);
    let payload: JWTPayload;
    try {
      payload = await verifyToken(token, jwtSecret);
    } catch {
      return c.json({ error: 'Unauthorized: Invalid token' }, 401);
    }

    const db = getDb(c.env.DB);
    const authRepo = new DrizzleAuthRepository(db);

    const session = await authRepo.getSessionById(payload.sessionId);
    if (!session || session.revoked || session.expiresAt <= Date.now()) {
      return c.json({ error: 'Unauthorized: Session is invalid, expired, or revoked' }, 401);
    }

    const user = await authRepo.findUserById(payload.userId);
    if (!user) {
      return c.json({ error: 'Unauthorized: User not found' }, 401);
    }
    if (!user.active) {
      return c.json({ error: 'Unauthorized: User is inactive' }, 401);
    }

    // Optimize session activity updates (5 min threshold)
    const FIVE_MINUTES_MS = 5 * 60 * 1000;
    const now = Date.now();
    if (now - session.lastSeenAt >= FIVE_MINUTES_MS) {
      c.executionCtx.waitUntil(
        authRepo.updateLastSeen(session.id, now).catch((err) => {
          console.error('Failed to update last seen at', err);
        }),
      );
    }

    c.set('jwtPayload', payload);
    c.set('session', session);
    c.set('user', user);

    await next();
  };
};

export const requireAdmin = (): MiddlewareHandler<AppEnv> => {
  return async (c, next) => {
    const user = c.get('user');
    if (!user || user.role !== 'ADMIN') {
      return c.json({ error: 'Forbidden: Access denied' }, 403);
    }
    await next();
  };
};

export const requirePasswordChanged = (): MiddlewareHandler<AppEnv> => {
  return async (c, next) => {
    const user = c.get('user');
    const path = c.req.path;
    const method = c.req.method;

    // Bypassed on POST /logout and PATCH /me/password
    const isLogout = method === 'POST' && path.endsWith('/logout');
    const isPasswordChange = method === 'PATCH' && path.endsWith('/me/password');

    if (user && user.mustChangePassword && !isLogout && !isPasswordChange) {
      return c.json({ error: 'Forbidden: You must change your password' }, 403);
    }
    await next();
  };
};
