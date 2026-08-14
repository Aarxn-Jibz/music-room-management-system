import { connect } from 'cloudflare:sockets';
import { SmtpTransport } from './smtp.js';

export interface WorkerSmtpConnection {
  host: string;
  port: number;
  secure: boolean;
}

export function createWorkerTransport(connection: WorkerSmtpConnection): SmtpTransport {
  const socket = connect(
    { hostname: connection.host, port: connection.port },
    {
      secureTransport: connection.secure ? 'on' : 'off',
      allowHalfOpen: true,
    },
  );
  const writer = socket.writable.getWriter();
  const reader = socket.readable.getReader();
  let buffer = '';

  return {
    async write(data: Uint8Array): Promise<void> {
      await writer.write(data);
    },
    async nextLine(): Promise<string> {
      for (;;) {
        const newline = buffer.indexOf('\n');
        if (newline !== -1) {
          const line = buffer.slice(0, newline);
          buffer = buffer.slice(newline + 1);
          return line.replace(/\r$/, '');
        }
        const { value, done } = await reader.read();
        if (done) {
          throw new Error('SMTP connection closed by server');
        }
        buffer += new TextDecoder().decode(value);
      }
    },
    async close(): Promise<void> {
      await socket.close().catch(() => {});
    },
  };
}
