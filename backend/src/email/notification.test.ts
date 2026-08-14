import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb } from '../test/db.js';
import { schema, DbClient } from '../db/client.js';
import { NotificationService, BookingNotificationEvent, TransportFactory, buildBookingEmail } from './index.js';
import { SmtpTransport } from './smtp.js';

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

const REJECT_AUTH = SUCCESS_RESPONSES.map((line, i) =>
  i === 7 ? '535 5.7.8 Username and Password not accepted' : line,
);

const ENV = {
  SMTP_HOST: 'smtp.gmail.com',
  SMTP_PORT: '465',
  SMTP_USER: 'sender@example.com',
  SMTP_PASSWORD: 'secret',
};

const event: BookingNotificationEvent = {
  kind: 'created',
  booking: {
    id: 'booking-1',
    status: 'pending',
    slot_start: '2026-08-17T10:00:00.000Z',
    slot_end: '2026-08-17T11:00:00.000Z',
    room_id: 'room-1',
    user_name: 'Member',
    band_name: 'University Choir',
    reason: 'rehearsal',
  },
};

describe('NotificationService', () => {
  let db: DbClient;
  let transports: FakeTransport[];

  const makeFactory = (responses: string[] = SUCCESS_RESPONSES): TransportFactory => {
    return () => {
      const t = new FakeTransport(responses);
      transports.push(t);
      return t;
    };
  };

  beforeEach(async () => {
    db = createTestDb();
    transports = [];
    await db.insert(schema.bookingPolicies).values({
      id: 'pol-1',
      name: 'Default policy',
      bookingHorizonDays: 7,
      minBookingDurationMinutes: 30,
      maxBookingDurationMinutes: 120,
      bookingIntervalMinutes: 30,
      active: true,
    });
    await db.insert(schema.systemSettings).values({
      id: 'ss-1',
      bookingReleaseDay: 1,
      bookingReleaseTime: '09:00',
      defaultPolicyId: 'pol-1',
    });
    await db.insert(schema.rooms).values({
      id: 'room-1',
      name: 'Main Room',
      number: 1,
      createdAt: Date.now(),
      active: true,
      policyId: 'pol-1',
    });
  });

  it('sends a notification to the configured recipient on a created booking', async () => {
    await db.update(schema.systemSettings).set({ notificationEmail: 'bookings@admin.local' }).run();

    const service = new NotificationService(db, ENV, makeFactory());
    await service.notify(event);

    expect(transports).toHaveLength(1);
    const written = transports[0].written.join('');
    expect(written).toContain('RCPT TO:<bookings@admin.local>');
    expect(written).toContain('MAIL FROM:<sender@example.com>');
    expect(written).toContain('Subject: New booking request');
    expect(written).toContain('Band / Profile: University Choir');
    expect(written).toContain('Room: Main Room');
    expect(written).toContain('Requested by: Member');
  });

  it('does not send an email when no recipient is configured', async () => {
    const service = new NotificationService(db, ENV, makeFactory());
    await service.notify(event);
    expect(transports).toHaveLength(0);
  });

  it('does not send an email when SMTP is not configured', async () => {
    await db.update(schema.systemSettings).set({ notificationEmail: 'bookings@admin.local' }).run();
    const service = new NotificationService(db, {}, makeFactory());
    await service.notify(event);
    expect(transports).toHaveLength(0);
  });

  it('does not throw and records an audit log when SMTP auth fails', async () => {
    await db.update(schema.systemSettings).set({ notificationEmail: 'bookings@admin.local' }).run();
    const service = new NotificationService(db, ENV, makeFactory(REJECT_AUTH));

    await expect(service.notify(event)).resolves.toBeUndefined();

    expect(transports).toHaveLength(1);
    const logs = await db.select().from(schema.auditLogs);
    const emailLog = logs.find((log) => log.action === 'EMAIL_FAILED');
    expect(emailLog).toBeDefined();
    expect(emailLog!.targetId).toBe('booking-1');
  });

  it('builds a human-readable email with the slot range', () => {
    const mail = buildBookingEmail(event, 'Main Room');
    expect(mail.subject).toContain('New booking request');
    expect(mail.subject).toContain('17 Aug 2026');
    expect(mail.body).toContain('Mon, 17 Aug 2026 10:00 UTC - 11:00 UTC');
    expect(mail.body).toContain('Band / Profile: University Choir');
    expect(mail.body).toContain('Reason: rehearsal');
  });
});
