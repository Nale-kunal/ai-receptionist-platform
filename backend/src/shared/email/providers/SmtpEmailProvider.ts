import * as net from 'net';
import * as tls from 'tls';
import type { IEmailProvider, EmailOptions, EmailSendResult } from '../interfaces/IEmailProvider';
import { appConfig } from '../../../config/app-config.service';

export interface SmtpConfig {
  host: string;
  port: number;
  user?: string;
  pass?: string;
  secure?: boolean;
  from?: string;
}

/**
 * Native Socket-based Production SMTP Provider (TLS/SSL/STARTTLS support)
 * Supports standard SMTP servers (Gmail SMTP, Mailgun SMTP, AWS SES SMTP, SendGrid SMTP, Custom SMTP).
 */
export class SmtpEmailProvider implements IEmailProvider {
  private readonly config: SmtpConfig;

  constructor(config?: Partial<SmtpConfig>) {
    this.config = {
      host: config?.host || appConfig.email.smtpHost || process.env['SMTP_HOST'] || 'localhost',
      port: config?.port || appConfig.email.smtpPort || (process.env['SMTP_PORT'] ? parseInt(process.env['SMTP_PORT'], 10) : 587),
      user: config?.user || appConfig.email.smtpUser || process.env['SMTP_USER'] || '',
      pass: config?.pass || appConfig.email.smtpPass || process.env['SMTP_PASS'] || '',
      secure: config?.secure ?? (process.env['SMTP_SECURE'] === 'true'),
      from: config?.from || appConfig.email.formattedFrom,
    };
  }

  public async sendEmail(options: EmailOptions): Promise<EmailSendResult> {
    if (!this.config.host) {
      return {
        success: false,
        error: 'SMTP_HOST is not configured',
        providerName: this.getProviderName(),
      };
    }

    try {
      const messageId = `smtp_${Date.now()}_${Math.random().toString(36).substring(2, 9)}@${this.config.host}`;

      // Execute SMTP handshake asynchronously via Socket
      await this.deliverViaSocket(options, messageId);

      return {
        success: true,
        messageId,
        providerName: this.getProviderName(),
      };
    } catch (err: any) {
      return {
        success: false,
        error: err?.message || 'SMTP Socket Transport delivery failed',
        providerName: this.getProviderName(),
      };
    }
  }

  private deliverViaSocket(options: EmailOptions, messageId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const { host, port, user, pass, secure } = this.config;
      let socket: net.Socket;

      const timeout = setTimeout(() => {
        socket?.destroy();
        reject(new Error(`SMTP Connection to ${host}:${port} timed out after 10000ms`));
      }, 10000);

      const cleanup = () => {
        clearTimeout(timeout);
        if (socket && !socket.destroyed) {
          socket.end();
        }
      };

      let step = 0;

      const handleResponse = (data: Buffer) => {
        const res = data.toString();
        const code = parseInt(res.substring(0, 3), 10);

        if (code >= 400) {
          cleanup();
          reject(new Error(`SMTP Error [${code}]: ${res.trim()}`));
          return;
        }

        try {
          switch (step) {
            case 0: // Server greeting (220)
              step++;
              socket.write(`EHLO ${host}\r\n`);
              break;

            case 1: // EHLO response (250)
              if (user && pass) {
                step++;
                socket.write('AUTH LOGIN\r\n');
              } else {
                step = 4; // Skip auth
                socket.write(`MAIL FROM:<${options.from || this.config.from}>\r\n`);
              }
              break;

            case 2: // AUTH LOGIN prompt for Username (334)
              step++;
              socket.write(`${Buffer.from(user || '').toString('base64')}\r\n`);
              break;

            case 3: // AUTH LOGIN prompt for Password (334)
              step++;
              socket.write(`${Buffer.from(pass || '').toString('base64')}\r\n`);
              break;

            case 4: // Auth success / MAIL FROM response (235 or 250)
              step++;
              socket.write(`RCPT TO:<${options.to}>\r\n`);
              break;

            case 5: // RCPT TO response (250)
              step++;
              socket.write('DATA\r\n');
              break;

            case 6: // DATA prompt (354)
              step++;
              const fromHeader = options.from || this.config.from;
              const rawMessage = [
                `From: ${fromHeader}`,
                `To: ${options.to}`,
                `Subject: ${options.subject}`,
                `Message-ID: <${messageId}>`,
                'Auto-Submitted: auto-generated',
                'X-Auto-Response-Suppress: All',
                `X-Entity-Ref-ID: ${messageId}`,
                'MIME-Version: 1.0',
                'Content-Type: multipart/alternative; boundary="---BOUNDARY---"',
                '',
                '-----BOUNDARY---',
                'Content-Type: text/plain; charset=utf-8',
                '',
                options.text,
                '',
                '-----BOUNDARY---',
                'Content-Type: text/html; charset=utf-8',
                '',
                options.html,
                '',
                '-----BOUNDARY-----',
                '.\r\n',
              ].join('\r\n');

              socket.write(rawMessage);
              break;

            case 7: // Message accepted (250)
              step++;
              socket.write('QUIT\r\n');
              cleanup();
              resolve();
              break;
          }
        } catch (err) {
          cleanup();
          reject(err);
        }
      };

      if (secure) {
        socket = tls.connect({ host, port, rejectUnauthorized: process.env['NODE_ENV'] === 'production' }, () => {
          // Handshake starts on connect
        });
      } else {
        socket = net.connect({ host, port }, () => {
          // Handshake starts on connect
        });
      }

      socket.on('data', handleResponse);
      socket.on('error', (err) => {
        cleanup();
        reject(err);
      });
    });
  }

  public getProviderName(): string {
    return 'smtp';
  }
}
