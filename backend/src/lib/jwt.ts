import { SignJWT, jwtVerify } from 'jose';

export interface JWTPayload {
  sessionId: string;
  userId: string;
  role: 'USER' | 'ADMIN';
}

const JWT_ALGORITHM = 'HS256';

function getSecretKey(secret: string): Uint8Array {
  return new TextEncoder().encode(secret);
}

export async function signToken(
  payload: JWTPayload,
  secret: string,
  expiresAtMs: number,
): Promise<string> {
  const secretKey = getSecretKey(secret);
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: JWT_ALGORITHM })
    .setExpirationTime(Math.floor(expiresAtMs / 1000))
    .sign(secretKey);
}

export async function verifyToken(token: string, secret: string): Promise<JWTPayload> {
  const secretKey = getSecretKey(secret);
  const { payload } = await jwtVerify(token, secretKey);
  return {
    sessionId: payload.sessionId as string,
    userId: payload.userId as string,
    role: payload.role as 'USER' | 'ADMIN',
  };
}
