import { MiddlewareHandler } from 'hono';

export const rateLimit = (): MiddlewareHandler => {
  return async (c, next) => {
    await next();
  };
};
