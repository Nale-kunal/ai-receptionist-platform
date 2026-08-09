export interface PasswordResetTemplateParams {
  resetLink: string;
  expiresInMinutes?: number;
}

export class PasswordResetTemplate {
  public static render(params: PasswordResetTemplateParams): { subject: string; html: string; text: string } {
    const { resetLink, expiresInMinutes = 60 } = params;
    const subject = 'Reset Your Dental AI Password';

    const text = `
Hello,

We received a request to reset your password for your Dental AI Receptionist account.

To reset your password, click or copy the link below into your browser:
${resetLink}

This link is valid for ${expiresInMinutes} minutes and can only be used once.

If you did not request a password reset, you can safely ignore this message.

Best regards,
Dental AI Security Team
`.trim();

    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${subject}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f4f5f7; margin: 0; padding: 0; }
    .wrapper { padding: 40px 16px; }
    .container { max-width: 580px; margin: 0 auto; background: #fff; border-radius: 16px; overflow: hidden; border: 1px solid #e2e8f0; }
    .header { background: #1e293b; padding: 32px; text-align: center; color: #fff; }
    .content { padding: 32px; color: #334155; line-height: 1.6; }
    .btn { display: inline-block; padding: 14px 28px; background: #4f46e5; color: #fff !important; text-decoration: none; font-weight: 700; border-radius: 10px; margin: 20px 0; }
    .footer { background: #f8fafc; padding: 20px; text-align: center; font-size: 12px; color: #94a3b8; border-top: 1px solid #e2e8f0; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="container">
      <div class="header">
        <h2 style="margin:0;">🔐 Password Reset Request</h2>
      </div>
      <div class="content">
        <p>Hello,</p>
        <p>We received a request to reset the password for your Dental AI account.</p>
        <div style="text-align: center;">
          <a href="${resetLink}" class="btn" target="_blank">Reset My Password</a>
        </div>
        <p style="font-size: 13px; color: #64748b; word-break: break-all;">
          Or copy link: <a href="${resetLink}">${resetLink}</a>
        </p>
        <p>This password reset link will expire in ${expiresInMinutes} minutes.</p>
      </div>
      <div class="footer">&copy; ${new Date().getFullYear()} Dental AI SaaS. All rights reserved.</div>
    </div>
  </div>
</body>
</html>
`.trim();

    return { subject, html, text };
  }
}
