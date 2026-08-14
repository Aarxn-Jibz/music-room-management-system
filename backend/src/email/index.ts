import { eq } from 'drizzle-orm';
import { DbClient, schema } from '../db/client.js';
import { writeAuditLog } from '../audit/index.js';
import { sendEmailSmtp, SmtpConfig, SmtpTransport } from './smtp.js';

export interface SmtpEnv {
  SMTP_HOST?: string;
  SMTP_PORT?: string;
  SMTP_USER?: string;
  SMTP_PASSWORD?: string;
}

export interface BookingNotificationEvent {
  kind: 'created' | 'approved' | 'denied';
  booking: {
    id: string;
    status: string;
    slot_start: string;
    slot_end: string;
    room_id: string;
    user_name?: string;
    band_name?: string;
    reason?: string;
  };
}

export type TransportFactory = (connection: {
  host: string;
  port: number;
  secure: boolean;
}) => SmtpTransport;

export interface EmailOptions {
  to: string;
  subject: string;
  body: string;
}

export function formatSlotRange(start: string, end: string): string {
  const s = new Date(start);
  const e = new Date(end);
  const date = s.toUTCString().slice(0, 16);
  const sTime = s.toUTCString().slice(17, 22);
  const eTime = e.toUTCString().slice(17, 22);
  return `${date} ${sTime} UTC - ${eTime} UTC`;
}

export function buildBookingEmail(event: BookingNotificationEvent, roomName: string): EmailOptions {
  const { booking } = event;
  const slot = formatSlotRange(booking.slot_start, booking.slot_end);
  const label =
    event.kind === 'created' ? 'New booking request' : event.kind === 'approved' ? 'Booking approved' : 'Booking rejected';

  const lines = [
    `${label}`,
    ``,
    `Booking ID: ${booking.id}`,
    `Status: ${booking.status}`,
    `Band / Profile: ${booking.band_name ?? 'Unknown'}`,
    `Room: ${roomName}`,
    `Slot: ${slot}`,
    `Requested by: ${booking.user_name ?? 'Unknown'}`,
    booking.reason ? `Reason: ${booking.reason}` : null,
  ].filter((line): line is string => line !== null);

  return {
    to: '',
    subject: `${label}: ${booking.band_name ?? 'Booking'} - ${slot}`,
    body: lines.join('\n'),
  };
}

export class NotificationService {
  constructor(
    private db: DbClient,
    private env: SmtpEnv,
    private createTransport: TransportFactory,
  ) {}

  private async getRecipient(): Promise<string | null> {
    const rows = await this.db
      .select({ notificationEmail: schema.systemSettings.notificationEmail })
      .from(schema.systemSettings)
      .limit(1);
    const email = rows[0]?.notificationEmail;
    return email && email.length > 0 ? email : null;
  }

  private smtpConfig(): SmtpConfig | null {
    const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD } = this.env;
    if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASSWORD) {
      return null;
    }
    const port = Number(SMTP_PORT);
    if (Number.isNaN(port)) {
      return null;
    }
    return {
      host: SMTP_HOST,
      port,
      username: SMTP_USER,
      password: SMTP_PASSWORD,
      from: SMTP_USER,
      secure: port === 465,
    };
  }

  async getRoomName(roomId: string): Promise<string> {
    const rows = await this.db
      .select({ name: schema.rooms.name })
      .from(schema.rooms)
      .where(eq(schema.rooms.id, roomId))
      .limit(1);
    return rows[0]?.name ?? roomId;
  }

  async notify(event: BookingNotificationEvent): Promise<void> {
    try {
      const recipient = await this.getRecipient();
      if (!recipient) {
        return;
      }
      const config = this.smtpConfig();
      if (!config) {
        return;
      }
      const roomName = await this.getRoomName(event.booking.room_id);
      const mail = buildBookingEmail(event, roomName);
      await sendEmailSmtp(config, { ...mail, to: recipient }, this.createTransport(config));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`Notification email failed for booking ${event.booking.id}: ${message}`, err);
      await writeAuditLog(
        this.db,
        null,
        'EMAIL_FAILED',
        'BOOKING',
        event.booking.id,
        { kind: event.kind, error: message },
      ).catch(() => {});
    }
  }
}

export interface BookingNotifier {
  notify(event: BookingNotificationEvent): Promise<void>;
}
