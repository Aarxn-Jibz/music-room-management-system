export type Fetcher = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

export interface GoogleTokenResponse {
  access_token?: string;
}

const SHEETS_API_BASE = 'https://sheets.googleapis.com/v4/spreadsheets';

export async function exchangeToken(
  fetchImpl: Fetcher,
  tokenUri: string,
  assertion: string,
): Promise<string> {
  const body = new URLSearchParams({
    grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
    assertion,
  });

  const response = await fetchImpl(tokenUri, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  const data = (await response.json().catch(() => null)) as GoogleTokenResponse | null;
  if (!response.ok || typeof data?.access_token !== 'string') {
    throw new Error(
      `Google token exchange failed: ${response.status} ${JSON.stringify(data ?? null)}`,
    );
  }
  return data.access_token;
}

function columnToA1(cols: number): string {
  let notation = '';
  let n = cols;
  while (n > 0) {
    const remainder = (n - 1) % 26;
    notation = String.fromCharCode(65 + remainder) + notation;
    n = Math.floor((n - 1) / 26);
  }
  return notation;
}

export function a1Range(rows: number, cols: number): string {
  return `A1:${columnToA1(cols)}${rows}`;
}

export function quoteSheetName(name: string): string {
  return `'${name.replace(/'/g, "''")}'`;
}

export interface SpreadsheetUpdate {
  spreadsheetId: string;
  tabName: string;
  values: string[][];
}

/**
 * Overwrites the fixed range holding `values` on the target tab. Writing the
 * full rectangle (including "" cells) makes every run idempotent: stale
 * content from previous runs is replaced, never appended.
 */
export async function updateSpreadsheet(
  fetchImpl: Fetcher,
  accessToken: string,
  update: SpreadsheetUpdate,
): Promise<void> {
  const cols = Math.max(1, ...update.values.map((row) => row.length));
  const range = `${quoteSheetName(update.tabName)}!${a1Range(update.values.length, cols)}`;
  const url = `${SHEETS_API_BASE}/${encodeURIComponent(update.spreadsheetId)}/values/${encodeURIComponent(range)}?valueInputOption=RAW`;

  const response = await fetchImpl(url, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      range,
      majorDimension: 'ROWS',
      values: update.values,
    }),
  });

  if (!response.ok) {
    throw new Error(`Google Sheets update failed: ${response.status} ${await response.text()}`);
  }
}
