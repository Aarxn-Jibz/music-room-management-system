export interface EmailOptions {
  to: string;
  subject: string;
  body: string;
}

export async function sendEmail(
  _options: EmailOptions,
  _env: { GMAIL_USER: string; GMAIL_PASS: string },
): Promise<void> {
  // Skeleton method to be filled in with cloudflare:sockets protocol logic.
  // In the execution phase, it will connect to smtp.gmail.com:465.
  return Promise.resolve();
}

export interface INotificationService {
  notifyBookingApproved(bookingId: string, userEmail: string): Promise<void>;
  notifyBookingRejected(bookingId: string, userEmail: string, reason?: string): Promise<void>;
}

export class MockNotificationService implements INotificationService {
  async notifyBookingApproved(bookingId: string, userEmail: string): Promise<void> {
    console.info(`Notification sent: Booking ${bookingId} approved. Recipient: ${userEmail}`);
    return Promise.resolve();
  }

  async notifyBookingRejected(
    bookingId: string,
    userEmail: string,
    reason?: string,
  ): Promise<void> {
    console.info(
      `Notification sent: Booking ${bookingId} rejected. Recipient: ${userEmail}. Reason: ${reason ?? 'None'}`,
    );
    return Promise.resolve();
  }
}
