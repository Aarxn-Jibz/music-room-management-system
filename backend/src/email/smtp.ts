export interface SmtpConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  from: string;
  secure: boolean;
}

export interface SmtpTransport {
  write(data: Uint8Array): Promise<void>;
  /** Resolves with the next CRLF-terminated line, without the trailing CRLF. */
  nextLine(): Promise<string>;
  close(): Promise<void>;
}

const CRLF = '\r\n';

class SmtpError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
  ) {
    super(message);
    this.name = 'SmtpError';
  }
}

function encode(data: string): Uint8Array {
  return new TextEncoder().encode(data);
}

/** Send a command and await the response code, handling multiline replies. */
async function expectCode(
  transport: SmtpTransport,
  expected: number[],
  context: string,
): Promise<void> {
  const line = await transport.nextLine();
  const code = line.slice(0, 3);
  const separator = line[3];
  if (!expected.includes(Number(code))) {
    throw new SmtpError(`SMTP ${context} rejected: ${line}`, code);
  }
  if (separator === '-') {
    // Multiline reply: keep consuming lines until the same code + space.
    let current = line;
    while (current[3] === '-') {
      current = await transport.nextLine();
      if (current.slice(0, 3) !== code) {
        throw new SmtpError(`SMTP ${context} malformed multiline reply`);
      }
    }
  }
}

function command(
  transport: SmtpTransport,
  line: string,
  expected: number[],
  context: string,
): Promise<void> {
  return transport.write(encode(line + CRLF)).then(() => expectCode(transport, expected, context));
}

function buildEmailData(options: {
  to: string;
  from: string;
  subject: string;
  body: string;
}): string {
  const lines = [
    `To: <${options.to}>`,
    `From: <${options.from}>`,
    `Subject: ${options.subject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    '',
    options.body,
  ];
  return lines.join(CRLF);
}

export interface SmtpMail {
  to: string;
  subject: string;
  body: string;
}

export async function sendEmailSmtp(
  config: SmtpConfig,
  mail: SmtpMail,
  transport: SmtpTransport,
): Promise<void> {
  try {
    // Greeting (server says 220).
    await expectCode(transport, [220], 'greeting');

    // EHLO.
    await command(transport, 'EHLO rejoy.local', [250], 'EHLO');

    // AUTH LOGIN.
    await command(transport, 'AUTH LOGIN', [334], 'AUTH LOGIN');
    await command(transport, btoa(config.username), [334], 'AUTH USERNAME');
    await command(transport, btoa(config.password), [235], 'AUTH PASSWORD');

    await command(transport, `MAIL FROM:<${config.from}>`, [250], 'MAIL FROM');
    await command(transport, `RCPT TO:<${mail.to}>`, [250], 'RCPT TO');
    await command(transport, 'DATA', [354], 'DATA');

    await transport.write(encode(buildEmailData({ to: mail.to, from: config.from, subject: mail.subject, body: mail.body }) + CRLF + '.' + CRLF));
    await expectCode(transport, [250], 'message');

    await command(transport, 'QUIT', [221], 'QUIT');
  } finally {
    await transport.close().catch(() => {});
  }
}

export { SmtpError };
