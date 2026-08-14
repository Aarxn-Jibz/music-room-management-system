import { describe, it, expect, beforeAll } from 'vitest';
import {
  base64UrlEncode,
  buildServiceAccountAssertion,
  decodeBase64,
  GOOGLE_SHEETS_SCOPE,
  parsePrivateKeyPem,
  ServiceAccountCredentials,
} from './jwt.js';

function toPem(bytes: Uint8Array, label: string): string {
  const b64 = Buffer.from(bytes).toString('base64');
  const wrapped = b64.match(/.{1,64}/g)?.join('\n') ?? b64;
  return `-----BEGIN ${label}-----\n${wrapped}\n-----END ${label}-----`;
}

let credentials: ServiceAccountCredentials;
let publicKey: CryptoKey;

beforeAll(async () => {
  const keyPair = (await crypto.subtle.generateKey(
    { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
    true,
    ['sign', 'verify'],
  )) as { privateKey: CryptoKey; publicKey: CryptoKey };

  const privatePem = toPem(
    new Uint8Array((await crypto.subtle.exportKey('pkcs8', keyPair.privateKey)) as ArrayBuffer),
    'PRIVATE KEY',
  );
  const publicSpki = new Uint8Array((await crypto.subtle.exportKey('spki', keyPair.publicKey)) as ArrayBuffer);

  credentials = {
    clientEmail: 'sheets@rejoy.example.iam.gserviceaccount.com',
    privateKey: privatePem,
    tokenUri: 'https://oauth2.googleapis.com/token',
    scope: GOOGLE_SHEETS_SCOPE,
  };

  publicKey = await crypto.subtle.importKey(
    'spki',
    publicSpki,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['verify'],
  );
});

describe('buildServiceAccountAssertion', () => {
  it('produces a well-formed three-part JWT', async () => {
    const assertion = await buildServiceAccountAssertion(credentials, Date.UTC(2026, 7, 16, 15, 30, 0));
    const parts = assertion.split('.');
    expect(parts).toHaveLength(3);
    expect(parts[0]).toBeTruthy();
    expect(parts[1]).toBeTruthy();
    expect(parts[2]).toBeTruthy();
  });

  it('encodes a RS256 JWT header', async () => {
    const assertion = await buildServiceAccountAssertion(credentials);
    const [headerB64] = assertion.split('.');
    const header = JSON.parse(new TextDecoder().decode(decodeBase64(headerB64)));
    expect(header).toEqual({ alg: 'RS256', typ: 'JWT' });
  });

  it('encodes issuer, scope, audience, and a valid iat/exp window', async () => {
    const nowMs = Date.UTC(2026, 7, 16, 15, 30, 0);
    const assertion = await buildServiceAccountAssertion(credentials, nowMs);
    const [, payloadB64] = assertion.split('.');
    const payload = JSON.parse(new TextDecoder().decode(decodeBase64(payloadB64)));
    expect(payload.iss).toBe(credentials.clientEmail);
    expect(payload.scope).toBe(GOOGLE_SHEETS_SCOPE);
    expect(payload.aud).toBe(credentials.tokenUri);
    expect(payload.iat).toBe(Math.floor(nowMs / 1000));
    expect(payload.exp).toBe(payload.iat + 3600);
  });

  it('signs the assertion with a signature that verifies (RS256)', async () => {
    const assertion = await buildServiceAccountAssertion(credentials, Date.now());
    const [headerB64, payloadB64, signatureB64] = assertion.split('.');
    const signature = decodeBase64(signatureB64);
    const input = new TextEncoder().encode(`${headerB64}.${payloadB64}`);
    const valid = await crypto.subtle.verify(
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      publicKey,
      signature,
      input,
    );
    expect(valid).toBe(true);
  });
});

describe('base64 utilities', () => {
  it('round-trips base64url encoding', () => {
    const bytes = new TextEncoder().encode('hello world');
    const encoded = base64UrlEncode(bytes);
    expect(encoded).not.toContain('+');
    expect(encoded).not.toContain('/');
    expect(encoded).not.toContain('=');
    expect(new TextDecoder().decode(decodeBase64(encoded))).toBe('hello world');
  });

  it('parses a PEM private key into raw PKCS8 bytes', () => {
    const pem = credentials.privateKey;
    const bytes = parsePrivateKeyPem(pem);
    expect(bytes.length).toBeGreaterThan(1000);
    // PKCS8 RSA private key starts with SEQUENCE (0x30)
    expect(bytes[0]).toBe(0x30);
  });
});
