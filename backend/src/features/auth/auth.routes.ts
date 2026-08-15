import { Hono } from 'hono';
import { loginSchema, changePasswordSchema, registerSchema } from '../../schemas.js';
import { getDb } from '../../db/client.js';
import { DrizzleAuthRepository } from './auth.repository.js';
import { AuthService } from './auth.service.js';
import { requireAuth, requirePasswordChanged, requireAdmin, AppEnv } from '../../middleware/auth.middleware.js';
import { resolveJwtSecret } from '../../config/index.js';

const authRoutes = new Hono<AppEnv>();

function serializeCookie(
  name: string,
  value: string,
  maxAge: number,
  isSecure: boolean,
): string {
  let cookie = `${name}=${encodeURIComponent(value)}`;
  cookie += '; HttpOnly';
  if (isSecure) {
    cookie += '; Secure';
  }
  cookie += '; SameSite=Strict';
  cookie += '; Path=/';
  cookie += `; Max-Age=${maxAge}`;
  return cookie;
}

authRoutes.post('/login', async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as unknown;
  const parseResult = loginSchema.safeParse(body);
  if (!parseResult.success) {
    return c.json({ error: 'Validation failed' }, 400);
  }

  const identifier = parseResult.data.email ?? parseResult.data.username ?? '';

  const db = getDb(c.env.DB);
  const authRepo = new DrizzleAuthRepository(db);
  const authService = new AuthService(authRepo);

  try {
    const result = await authService.login(
      identifier,
      parseResult.data.password,
      resolveJwtSecret(c.env.JWT_SECRET),
    );

    c.header(
      'Set-Cookie',
      serializeCookie('token', result.token, 86400, c.req.url.startsWith('https://')),
      { append: true },
    );

    return c.json({
      success: true,
      user: result.user,
    });
  } catch (err) {
    if (err instanceof Error && err.message === 'UNAUTHORIZED') {
      return c.json({ error: 'Invalid username or password' }, 401);
    }
    console.error('LOGIN_ERROR', err);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

authRoutes.post('/register', requireAuth(), requirePasswordChanged(), requireAdmin(), async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as unknown;
  const parseResult = registerSchema.safeParse(body);
  if (!parseResult.success) {
    return c.json({ message: 'Validation failed', error: 'Validation failed' }, 400);
  }

  const db = getDb(c.env.DB);
  const authRepo = new DrizzleAuthRepository(db);
  const authService = new AuthService(authRepo);

  try {
    const user = await authService.register(parseResult.data);
    return c.json({ message: 'User registered successfully', user }, 201);
  } catch (err) {
    if (err instanceof Error && err.message === 'DUPLICATE_EMAIL') {
      return c.json({ message: 'User already exists', error: 'User already exists' }, 400);
    }
    return c.json({ message: 'Internal server error', error: 'Internal server error' }, 500);
  }
});

authRoutes.post('/logout', requireAuth(), async (c) => {
  const session = c.get('session');
  const db = getDb(c.env.DB);
  const authRepo = new DrizzleAuthRepository(db);
  const authService = new AuthService(authRepo);

  await authService.logout(session.id);

  c.header('Set-Cookie', serializeCookie('token', '', 0, c.req.url.startsWith('https://')), {
    append: true,
  });

  return c.json({ success: true });
});

authRoutes.get('/me', requireAuth(), async (c) => {
  const user = c.get('user');
  const db = getDb(c.env.DB);
  const authRepo = new DrizzleAuthRepository(db);
  const authService = new AuthService(authRepo);

  try {
    const result = await authService.getMe(user.id);
    return c.json(result);
  } catch {
    return c.json({ error: 'Not found' }, 404);
  }
});

authRoutes.patch('/me/password', requireAuth(), async (c) => {
  const user = c.get('user');
  const body = (await c.req.json().catch(() => ({}))) as unknown;
  const parseResult = changePasswordSchema.safeParse(body);
  if (!parseResult.success) {
    return c.json({ error: 'Validation failed' }, 400);
  }

  const db = getDb(c.env.DB);
  const authRepo = new DrizzleAuthRepository(db);
  const authService = new AuthService(authRepo);

  try {
    await authService.changePassword(
      user.id,
      parseResult.data.currentPassword,
      parseResult.data.newPassword,
    );
    return c.json({ success: true });
  } catch (err) {
    if (err instanceof Error && err.message === 'UNAUTHORIZED') {
      return c.json({ error: 'Incorrect current password' }, 401);
    }
    return c.json({ error: 'Internal server error' }, 500);
  }
});

export { authRoutes };
