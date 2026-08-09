export interface EmailVerificationTemplateParams {
  verifyLink: string;
}

export class EmailVerificationTemplate {
  public static render(params: EmailVerificationTemplateParams): { subject: string; html: string; text: string } {
    const { verifyLink } = params;
    const subject = 'Verify Your Email Address — Dental AI';

    const text = `
Hello,

Thank you for registering with Dental AI Receptionist SaaS.

Please verify your email address by clicking or copying the link below into your browser:
${verifyLink}

Best regards,
The Dental AI Team
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
    .header { background: #4f46e5; padding: 32px; text-align: center; color: #fff; }
    .content { padding: 32px; color: #334155; line-height: 1.6; }
    .btn { display: inline-block; padding: 14px 28px; background: #4f46e5; color: #fff !important; text-decoration: none; font-weight: 700; border-radius: 10px; margin: 20px 0; }
    .footer { background: #f8fafc; padding: 20px; text-align: center; font-size: 12px; color: #94a3b8; border-top: 1px solid #e2e8f0; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="container">
      <div class="header">
        <h2 style="margin:0;">✉️ Verify Your Email Address</h2>
      </div>
      <div class="content">
        <p>Hello,</p>
        <p>Thank you for signing up for Dental AI Receptionist. Please verify your email address to complete registration.</p>
        <div style="text-align: center;">
          <a href="${verifyLink}" class="btn" target="_blank">Verify Email Address</a>
        </div>
        <p style="font-size: 13px; color: #64748b; word-break: break-all;">
          Or copy link: <a href="${verifyLink}">${verifyLink}</a>
        </p>
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
