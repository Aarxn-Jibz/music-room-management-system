import { describe, it, expect } from 'vitest';
import { sendEmailSmtp, SmtpTransport, SmtpError } from './smtp.js';

class FakeTransport implements SmtpTransport {
  written: string[] = [];
  private index = 0;
  constructor(private responses: string[]) {}
  async write(data: Uint8Array): Promise<void> {
    this.written.push(new TextDecoder().decode(data));
  }
  async nextLine(): Promise<string> {
    const line = this.responses[this.index++];
    if (line === undefined) {
      throw new Error('No more scripted SMTP responses');
    }
    return line;
  }
  async close(): Promise<void> {}
}

const SUCCESS_RESPONSES = [
  '220 smtp.gmail.com ESMTP ready',
  '250-smtp.gmail.com at your service',
  '250-SIZE 35882577',
  '250-AUTH LOGIN PLAIN XOAUTH2',
  '250-ENHANCEDSTATUSCODES',
  '250 SMTPUTF8',
  '334 VXNlcm5hbWU6',
  '334 UGFzc3dvcmQ6',
  '235 2.7.0 Accepted',
  '250 2.1.0 OK',
  '250 2.1.5 OK',
  '354 End data with <CR><LF>.<CR><LF>',
  '250 2.0.0 OK queued',
  '221 2.0.0 Bye',
];

const CONFIG = {
  host: 'smtp.gmail.com',
  port: 465,
  username: 'sender@example.com',
  password: 'secret',
  from: 'sender@example.com',
  secure: true,
};

const MAIL = { to: 'recipient@example.com', subject: 'New booking request', body: 'Details' };

describe('sendEmailSmtp', () => {
  it('runs the full SMTP conversation (EHLO, AUTH LOGIN, MAIL, RCPT, DATA, QUIT)', async () => {
    const transport = new FakeTransport(SUCCESS_RESPONSES);
    await sendEmailSmtp(CONFIG, MAIL, transport);

    const commands = transport.written;
    expect(commands[0]).toBe('EHLO rejoy.local\r\n');
    expect(commands[1]).toBe('AUTH LOGIN\r\n');
    expect(commands[2]).toBe(btoa(CONFIG.username) + '\r\n');
    expect(commands[3]).toBe(btoa(CONFIG.password) + '\r\n');
    expect(commands[4]).toBe('MAIL FROM:<sender@example.com>\r\n');
    expect(commands[5]).toBe('RCPT TO:<recipient@example.com>\r\n');
    expect(commands[6]).toBe('DATA\r\n');
    const payload = commands[7];
    expect(payload).toContain('Subject: New booking request');
    expect(payload).toContain('To: <recipient@example.com>');
    expect(payload.trimEnd().endsWith('.')).toBe(true);
    expect(commands[8]).toBe('QUIT\r\n');
  });

  it('throws when the server rejects AUTH LOGIN', async () => {
    const rejected = [...SUCCESS_RESPONSES];
    rejected[8] = '535 5.7.8 Username and Password not accepted';
    const transport = new FakeTransport(rejected);
    await expect(sendEmailSmtp(CONFIG, MAIL, transport)).rejects.toBeInstanceOf(SmtpError);
  });

  it('throws when the server does not send a greeting', async () => {
    const transport = new FakeTransport(['554 5.7.1 Service not available']);
    await expect(sendEmailSmtp(CONFIG, MAIL, transport)).rejects.toBeInstanceOf(SmtpError);
  });
});
