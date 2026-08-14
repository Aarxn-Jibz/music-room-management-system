import { describe, it, expect } from 'vitest';
import { a1Range, exchangeToken, quoteSheetName, updateSpreadsheet } from './google.js';

interface FetchCall {
  url: string;
  init?: RequestInit;
}

function recordingFetch(
  handler: (url: string, init?: RequestInit) => Promise<Response>,
): { fetcher: (input: string | URL | Request, init?: RequestInit) => Promise<Response>; calls: FetchCall[] } {
  const calls: FetchCall[] = [];
  const fetcher = async (input: string | URL | Request, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    calls.push({ url, init });
    return handler(url, init);
  };
  return { fetcher, calls };
}

describe('a1Range / quoteSheetName', () => {
  it('computes the A1 range for a rectangle', () => {
    expect(a1Range(1, 1)).toBe('A1:A1');
    expect(a1Range(15, 12)).toBe('A1:L15');
    expect(a1Range(3, 27)).toBe('A1:AA3');
    expect(a1Range(2, 28)).toBe('A1:AB2');
  });

  it('quotes sheet names with spaces and escapes single quotes', () => {
    expect(quoteSheetName('Week of 2026-08-10')).toBe("'Week of 2026-08-10'");
    expect(quoteSheetName("O'Brien")).toBe("'O''Brien'");
  });
});

describe('exchangeToken', () => {
  it('POSTs a JWT assertion and returns the access token', async () => {
    const { fetcher, calls } = recordingFetch(async (url, init) => {
      expect(url).toBe('https://oauth2.googleapis.com/token');
      expect(init?.method).toBe('POST');
      expect(init?.headers).toMatchObject({ 'Content-Type': 'application/x-www-form-urlencoded' });
      const body = String(init?.body ?? '');
      expect(body).toContain('grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer');
      expect(body).toContain('assertion=abc.def.ghi');
      return new Response(JSON.stringify({ access_token: 'tok-123', token_type: 'Bearer' }), { status: 200 });
    });

    const token = await exchangeToken(fetcher, 'https://oauth2.googleapis.com/token', 'abc.def.ghi');
    expect(token).toBe('tok-123');
    expect(calls).toHaveLength(1);
  });

  it('throws when the token endpoint errors', async () => {
    const { fetcher } = recordingFetch(async () => new Response('nope', { status: 500 }));
    await expect(exchangeToken(fetcher, 'https://oauth2.googleapis.com/token', 'a.b.c')).rejects.toThrow(
      'Google token exchange failed',
    );
  });

  it('throws when the response has no access_token', async () => {
    const { fetcher } = recordingFetch(async () => new Response(JSON.stringify({}), { status: 200 }));
    await expect(exchangeToken(fetcher, 'https://oauth2.googleapis.com/token', 'a.b.c')).rejects.toThrow(
      'Google token exchange failed',
    );
  });
});

describe('updateSpreadsheet', () => {
  const values = [['Room / Day', '09:00', '10:00'], ['Main Room - Monday', 'University Choir', '']];

  it('PUTs the full rectangle to the deterministic tab range', async () => {
    const { fetcher, calls } = recordingFetch(async (url, init) => {
      expect(url).toContain('/spreadsheets/SPREADID/values/');
      expect(url).toContain('valueInputOption=RAW');
      // encodeURIComponent leaves ' ! * ( ) unescaped per the ECMAScript spec.
      expect(url).toContain(`'Week%20of%202026-08-10'!A1%3AC2`);
      expect(init?.method).toBe('PUT');
      expect(init?.headers).toMatchObject({ Authorization: 'Bearer tok-123', 'Content-Type': 'application/json' });
      const body = JSON.parse(String(init?.body));
      expect(body).toEqual({
        range: "'Week of 2026-08-10'!A1:C2",
        majorDimension: 'ROWS',
        values,
      });
      return new Response(JSON.stringify({ updatedCells: 6 }), { status: 200 });
    });

    await updateSpreadsheet(fetcher, 'tok-123', {
      spreadsheetId: 'SPREADID',
      tabName: 'Week of 2026-08-10',
      values,
    });
    expect(calls).toHaveLength(1);
  });

  it('throws when Google rejects the update', async () => {
    const { fetcher } = recordingFetch(async () => new Response('forbidden', { status: 403 }));
    await expect(
      updateSpreadsheet(fetcher, 'tok', { spreadsheetId: 's', tabName: 't', values: [['a']] }),
    ).rejects.toThrow('Google Sheets update failed: 403');
  });
});
