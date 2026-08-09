export interface InvitationTemplateParams {
  toEmail: string;
  type?: string;
  currentRoleName?: string;
  roleName: string;
  tenantName: string;
  inviterName: string;
  inviteLink: string;
  expiresInDays?: number;
}

const ROLE_DISPLAY_NAMES: Record<string, string> = {
  clinic_owner: 'Practice Owner',
  doctor: 'Dentist',
  receptionist: 'Receptionist',
  admin: 'Administrator',
};

export class InvitationEmailTemplate {
  public static render(params: InvitationTemplateParams): { subject: string; html: string; text: string } {
    const { toEmail, type = 'new_user', currentRoleName, roleName, tenantName, inviterName, inviteLink, expiresInDays = 7 } = params;
    const formattedRole = ROLE_DISPLAY_NAMES[roleName] || roleName;
    const formattedCurrentRole = currentRoleName ? (ROLE_DISPLAY_NAMES[currentRoleName] || currentRoleName) : null;

    let subject = `You've been invited to join ${tenantName} on Dental AI`;
    let heading = `You've Been Invited!`;
    let bodyIntro = `<strong>${inviterName}</strong> has invited you to join the team at <strong>${tenantName}</strong> as a <strong>${formattedRole}</strong> on Dental AI.`;
    let ctaText = `Accept Invitation & Join Practice`;

    if (type === 'role_change') {
      subject = `Role Change Request for ${tenantName} on Dental AI`;
      heading = `Role Change Request`;
      bodyIntro = `<strong>${inviterName}</strong> has requested to change your role at <strong>${tenantName}</strong> from <strong>${formattedCurrentRole || 'Current Role'}</strong> to <strong>${formattedRole}</strong>.`;
      ctaText = `Review & Accept Role Change`;
    } else if (type === 'role_assignment') {
      subject = `New Role Assignment for ${tenantName} on Dental AI`;
      heading = `Practice Membership Request`;
      bodyIntro = `<strong>${inviterName}</strong> has invited your existing Dental AI account to join <strong>${tenantName}</strong> as a <strong>${formattedRole}</strong>.`;
      ctaText = `Review & Accept Membership`;
    }

    const text = `
Hello,

${inviterName} has sent an invitation for ${tenantName} on Dental AI.

Recipient: ${toEmail}
Role Assigned: ${formattedRole}
${formattedCurrentRole ? `Current Role: ${formattedCurrentRole}\n` : ''}

To review and accept this request, click or copy the following link into your browser:
${inviteLink}

This invitation link is secure, single-use, and will expire in ${expiresInDays} days.

If you did not expect this request, you can safely ignore this email.

Best regards,
The ${tenantName} Team & Dental AI
`.trim();

    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      background-color: #f4f5f7;
      color: #1e293b;
      -webkit-font-smoothing: antialiased;
    }
    .wrapper {
      width: 100%;
      background-color: #f4f5f7;
      padding: 40px 16px;
    }
    .container {
      max-width: 580px;
      margin: 0 auto;
      background-color: #ffffff;
      border-radius: 16px;
      overflow: hidden;
      box-shadow: 0 10px 25px rgba(0, 0, 0, 0.05);
      border: 1px solid #e2e8f0;
    }
    .header {
      background: linear-gradient(135deg, #4f46e5 0%, #3b82f6 100%);
      padding: 36px 32px;
      text-align: center;
      color: #ffffff;
    }
    .header-logo {
      font-size: 24px;
      font-weight: 800;
      letter-spacing: -0.5px;
      margin: 0;
    }
    .header-sub {
      font-size: 14px;
      opacity: 0.9;
      margin-top: 6px;
    }
    .content {
      padding: 36px 32px;
    }
    .greeting {
      font-size: 18px;
      font-weight: 700;
      color: #0f172a;
      margin-top: 0;
      margin-bottom: 16px;
    }
    .body-text {
      font-size: 15px;
      line-height: 1.6;
      color: #334155;
      margin-bottom: 24px;
    }
    .invitation-card {
      background-color: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 20px;
      margin-bottom: 28px;
    }
    .meta-row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 10px;
      font-size: 14px;
    }
    .meta-row:last-child {
      margin-bottom: 0;
    }
    .meta-label {
      color: #64748b;
      font-weight: 500;
    }
    .meta-value {
      color: #0f172a;
      font-weight: 600;
    }
    .badge {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 9999px;
      font-size: 12px;
      font-weight: 700;
      background-color: #e0e7ff;
      color: #4338ca;
    }
    .btn-container {
      text-align: center;
      margin-bottom: 28px;
    }
    .btn {
      display: inline-block;
      padding: 14px 32px;
      background-color: #4f46e5;
      color: #ffffff !important;
      text-decoration: none;
      font-weight: 700;
      font-size: 16px;
      border-radius: 10px;
      box-shadow: 0 4px 12px rgba(79, 70, 229, 0.3);
    }
    .fallback {
      font-size: 13px;
      color: #64748b;
      line-height: 1.5;
      word-break: break-all;
      background: #f1f5f9;
      padding: 12px;
      border-radius: 8px;
      margin-bottom: 24px;
    }
    .footer {
      background-color: #f8fafc;
      padding: 24px 32px;
      border-top: 1px solid #e2e8f0;
      text-align: center;
      font-size: 12px;
      color: #94a3b8;
      line-height: 1.5;
    }
    @media (prefers-color-scheme: dark) {
      body, .wrapper { background-color: #0f172a !important; }
      .container { background-color: #1e293b !important; border-color: #334155 !important; }
      .greeting { color: #f8fafc !important; }
      .body-text { color: #cbd5e1 !important; }
      .invitation-card { background-color: #0f172a !important; border-color: #334155 !important; }
      .meta-label { color: #94a3b8 !important; }
      .meta-value { color: #f8fafc !important; }
      .fallback { background-color: #0f172a !important; color: #94a3b8 !important; }
      .footer { background-color: #0f172a !important; border-color: #334155 !important; color: #64748b !important; }
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="container">
      <div class="header">
        <h1 class="header-logo">🦷 Dental AI Receptionist</h1>
        <div class="header-sub">Practice Management &amp; Team Access</div>
      </div>
      <div class="content">
        <h2 class="greeting">${heading}</h2>
        <p class="body-text">
          ${bodyIntro}
        </p>

        <div class="invitation-card">
          <div class="meta-row">
            <span class="meta-label">Practice</span>
            <span class="meta-value">${tenantName}</span>
          </div>
          <div class="meta-row">
            <span class="meta-label">Invited Email</span>
            <span class="meta-value">${toEmail}</span>
          </div>
          ${formattedCurrentRole ? `
          <div class="meta-row">
            <span class="meta-label">Current Role</span>
            <span class="meta-value">${formattedCurrentRole}</span>
          </div>
          ` : ''}
          <div class="meta-row">
            <span class="meta-label">Target Role</span>
            <span class="meta-value"><span class="badge">${formattedRole}</span></span>
          </div>
          <div class="meta-row">
            <span class="meta-label">Expires In</span>
            <span class="meta-value">${expiresInDays} days</span>
          </div>
        </div>

        <div class="btn-container">
          <a href="${inviteLink}" class="btn" target="_blank">${ctaText}</a>
        </div>

        <div class="fallback">
          <strong>Button not working?</strong> Copy and paste this link into your browser:<br>
          <a href="${inviteLink}" style="color: #4f46e5;">${inviteLink}</a>
        </div>
      </div>
      <div class="footer">
        This single-use invitation is intended solely for ${toEmail}.<br>
        If you were not expecting this invitation, no action is required.<br>&copy; ${new Date().getFullYear()} Dental AI SaaS. All rights reserved.
      </div>
    </div>
  </div>
</body>
</html>
`.trim();

    return { subject, html, text };
  }
}
