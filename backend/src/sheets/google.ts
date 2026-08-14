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

/**
 * Returns the titles of every tab in the spreadsheet. Used to detect whether
 * the deterministic weekly tab already exists before writing to it.
 */
export async function listSheetTitles(
  fetchImpl: Fetcher,
  spreadsheetId: string,
  accessToken: string,
): Promise<string[]> {
  const url = `${SHEETS_API_BASE}/${encodeURIComponent(spreadsheetId)}?fields=sheets.properties.title`;
  const response = await fetchImpl(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = (await response.json().catch(() => null)) as {
    sheets?: Array<{ properties?: { title?: string } }>;
  } | null;
  if (!response.ok) {
    throw new Error(`Google Sheets metadata failed: ${response.status} ${JSON.stringify(data ?? null)}`);
  }
  return (data?.sheets ?? [])
    .map((sheet) => sheet.properties?.title)
    .filter((title): title is string => typeof title === 'string');
}

/**
 * Creates a tab. Google Sheets does not create tabs implicitly on
 * `values.update`, so a missing weekly tab would otherwise fail every run.
 */
export async function addSheet(
  fetchImpl: Fetcher,
  spreadsheetId: string,
  accessToken: string,
  title: string,
): Promise<void> {
  const url = `${SHEETS_API_BASE}/${encodeURIComponent(spreadsheetId)}:batchUpdate`;
  const response = await fetchImpl(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ requests: [{ addSheet: { properties: { title } } }] }),
  });
  if (!response.ok) {
    throw new Error(`Google Sheets tab creation failed: ${response.status} ${await response.text()}`);
  }
}

// Any sheet beyond ZZ columns is irrelevant to the weekly grid.
const MAX_GRID_COLUMNS = 702;

/**
 * Ranges covering every cell the weekly grid could have occupied on earlier
 * runs: everything below the current rectangle and everything to its right.
 * `values.update` only touches the current rectangle, so without these clears a
 * grid that shrank (a room deactivated or a slot removed) would leave stale
 * cells. Clears are issued after the write so a mid-run failure never blanks a
 * tab that still holds valid data.
 */
export function staleClearRanges(tabName: string, rows: number, cols: number): string[] {
  const quoted = quoteSheetName(tabName);
  const ranges = [`${quoted}!A${rows + 1}:ZZ99999`];
  if (cols < MAX_GRID_COLUMNS) {
    ranges.push(`${quoted}!${columnToA1(cols + 1)}1:ZZ99999`);
  }
  return ranges;
}

/**
 * Clears multiple ranges in one call (Google clamps out-of-bounds ranges, so
 * the generous bounds above are safe).
 */
export async function batchClear(
  fetchImpl: Fetcher,
  spreadsheetId: string,
  accessToken: string,
  ranges: string[],
): Promise<void> {
  const url = `${SHEETS_API_BASE}/${encodeURIComponent(spreadsheetId)}/values:batchClear`;
  const response = await fetchImpl(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ ranges }),
  });
  if (!response.ok) {
    throw new Error(`Google Sheets clear failed: ${response.status} ${await response.text()}`);
  }
}
