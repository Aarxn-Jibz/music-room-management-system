const encoder = new TextEncoder();

export function base64UrlEncode(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

export function decodeBase64(input: string): Uint8Array {
  const binary = atob(input.replace(/-/g, '+').replace(/_/g, '/'));
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    out[i] = binary.charCodeAt(i);
  }
  return out;
}

export function parsePrivateKeyPem(pem: string): Uint8Array {
  const base64 = pem
    .replace(/-----BEGIN PRIVATE KEY-----/g, '')
    .replace(/-----END PRIVATE KEY-----/g, '')
    .replace(/\s+/g, '');
  return decodeBase64(base64);
}

export interface ServiceAccountCredentials {
  clientEmail: string;
  privateKey: string;
  tokenUri: string;
  scope: string;
}

export const GOOGLE_SHEETS_SCOPE = 'https://www.googleapis.com/auth/spreadsheets';

function base64UrlJson(value: unknown): string {
  return base64UrlEncode(encoder.encode(JSON.stringify(value)));
}

/**
 * Builds a signed JWT assertion (RS256) for a Google service account using the
 * platform WebCrypto API (crypto.subtle), which is available both in Workers
 * and in Node.js, so the same code path runs in tests.
 */
export async function buildServiceAccountAssertion(
  credentials: ServiceAccountCredentials,
  nowMs: number = Date.now(),
): Promise<string> {
  const header = { alg: 'RS256', typ: 'JWT' };
  const issuedAt = Math.floor(nowMs / 1000);
  const claims = {
    iss: credentials.clientEmail,
    scope: credentials.scope,
    aud: credentials.tokenUri,
    iat: issuedAt,
    exp: issuedAt + 3600,
  };

  const signingInput = `${base64UrlJson(header)}.${base64UrlJson(claims)}`;

  const key = await crypto.subtle.importKey(
    'pkcs8',
    parsePrivateKeyPem(credentials.privateKey),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = new Uint8Array(
    await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, encoder.encode(signingInput)),
  );

  return `${signingInput}.${base64UrlEncode(signature)}`;
}
