export const DEFAULT_JWT_SECRET = 'rejoy-dev-secret-change-me-in-production';

export function resolveJwtSecret(configured: string | undefined): string {
  return configured && configured.length > 0 ? configured : DEFAULT_JWT_SECRET;
}
