export interface AccessRevokedTemplateParams {
  toEmail: string;
  recipientName?: string;
  roleName: string;
  tenantName: string;
  revokerName: string;
  revokedAt: Date;
  reason: string;
  timezone?: string;
}

const ROLE_DISPLAY_NAMES: Record<string, string> = {
  clinic_owner: 'Practice Owner',
  doctor: 'Dentist',
  receptionist: 'Receptionist',
  admin: 'Administrator',
  tenant_owner: 'Practice Owner',
};

export class AccessRevokedEmailTemplate {
  public static render(params: AccessRevokedTemplateParams): { subject: string; html: string; text: string } {
    const {
      toEmail,
      recipientName,
      roleName,
      tenantName,
      revokerName,
      revokedAt,
      reason,
      timezone = 'UTC',
    } = params;

    const formattedRole = ROLE_DISPLAY_NAMES[roleName] || roleName;
    const subject = `Your access to ${tenantName} has been revoked`;

    // Format server date accurately
    const formattedDate = new Intl.DateTimeFormat('en-US', {
      dateStyle: 'full',
      timeStyle: 'medium',
      timeZone: timezone === 'UTC' || !timezone ? 'UTC' : timezone,
    }).format(new Date(revokedAt));

    const text = `
Access Revoked

Your access to ${tenantName} has been revoked.

Access Details:
- Clinic: ${tenantName}
- Your role: ${formattedRole}
- Email: ${toEmail}
- Revoked by: ${revokerName}
- Revoked on: ${formattedDate}
- Reason: ${reason}

Your access to this clinic has been revoked and you can no longer access its clinic resources.

If you believe this was done in error, please contact the clinic directly.

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
      background-color: #f8fafc;
      color: #1e293b;
      -webkit-font-smoothing: antialiased;
    }
    .wrapper {
      width: 100%;
      background-color: #f8fafc;
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
      background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%);
      padding: 36px 32px;
      text-align: center;
      color: #ffffff;
    }
    .header-logo {
      font-size: 22px;
      font-weight: 800;
      letter-spacing: -0.5px;
      margin-bottom: 8px;
    }
    .header-title {
      font-size: 24px;
      font-weight: 700;
      margin: 0;
      color: #ffffff;
    }
    .content {
      padding: 36px 32px;
    }
    .lead-text {
      font-size: 16px;
      line-height: 1.6;
      color: #334155;
      margin-bottom: 24px;
    }
    .card {
      background-color: #f8fafc;
      border-radius: 12px;
      border: 1px solid #e2e8f0;
      padding: 20px;
      margin-bottom: 24px;
    }
    .card-row {
      display: flex;
      justify-content: space-between;
      padding: 10px 0;
      border-bottom: 1px solid #edf2f7;
      font-size: 14px;
    }
    .card-row:last-child {
      border-bottom: none;
      padding-bottom: 0;
    }
    .card-row:first-child {
      padding-top: 0;
    }
    .card-label {
      color: #64748b;
      font-weight: 600;
      width: 35%;
    }
    .card-value {
      color: #0f172a;
      font-weight: 600;
      width: 65%;
      text-align: right;
    }
    .reason-box {
      background-color: #fef2f2;
      border-left: 4px solid #ef4444;
      border-radius: 6px;
      padding: 14px 16px;
      margin-bottom: 24px;
      font-size: 14px;
      line-height: 1.5;
      color: #991b1b;
    }
    .reason-title {
      font-weight: 700;
      margin-bottom: 4px;
      text-transform: uppercase;
      font-size: 12px;
      letter-spacing: 0.5px;
      color: #b91c1c;
    }
    .notice {
      font-size: 13px;
      line-height: 1.6;
      color: #64748b;
      padding: 16px;
      background-color: #f1f5f9;
      border-radius: 8px;
      margin-bottom: 24px;
    }
    .footer {
      background-color: #f8fafc;
      border-top: 1px solid #e2e8f0;
      padding: 24px 32px;
      text-align: center;
      font-size: 12px;
      color: #94a3b8;
      line-height: 1.5;
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="container">
      <div class="header">
        <div class="header-logo">Dental AI Platform</div>
        <h1 class="header-title">Access Revoked</h1>
      </div>
      <div class="content">
        <p class="lead-text">
          ${recipientName ? `Hello <strong>${recipientName}</strong>,<br><br>` : ''}
          Your practice membership access to <strong>${tenantName}</strong> has been revoked.
        </p>

        <!-- Access Details Card -->
        <div class="card">
          <table style="width: 100%; border-collapse: collapse;">
            <tr style="border-bottom: 1px solid #edf2f7;">
              <td style="padding: 8px 0; color: #64748b; font-size: 13px; font-weight: 600;">Clinic:</td>
              <td style="padding: 8px 0; color: #0f172a; font-size: 13px; font-weight: 700; text-align: right;">${tenantName}</td>
            </tr>
            <tr style="border-bottom: 1px solid #edf2f7;">
              <td style="padding: 8px 0; color: #64748b; font-size: 13px; font-weight: 600;">Your role:</td>
              <td style="padding: 8px 0; color: #0f172a; font-size: 13px; font-weight: 700; text-align: right;">${formattedRole}</td>
            </tr>
            <tr style="border-bottom: 1px solid #edf2f7;">
              <td style="padding: 8px 0; color: #64748b; font-size: 13px; font-weight: 600;">Email:</td>
              <td style="padding: 8px 0; color: #0f172a; font-size: 13px; font-weight: 700; text-align: right;">${toEmail}</td>
            </tr>
            <tr style="border-bottom: 1px solid #edf2f7;">
              <td style="padding: 8px 0; color: #64748b; font-size: 13px; font-weight: 600;">Revoked by:</td>
              <td style="padding: 8px 0; color: #0f172a; font-size: 13px; font-weight: 700; text-align: right;">${revokerName}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #64748b; font-size: 13px; font-weight: 600;">Revoked on:</td>
              <td style="padding: 8px 0; color: #0f172a; font-size: 13px; font-weight: 700; text-align: right;">${formattedDate}</td>
            </tr>
          </table>
        </div>

        <!-- Reason Card -->
        <div class="reason-box">
          <div class="reason-title">Reason for Revocation</div>
          <div>${reason}</div>
        </div>

        <!-- Notice -->
        <div class="notice">
          <p style="margin: 0 0 8px 0;"><strong>Immediate Effect:</strong> Your access to this clinic has been revoked and you can no longer access its clinic resources or workflows.</p>
          <p style="margin: 0;">If you believe this was done in error, please contact the clinic administration directly.</p>
        </div>
      </div>
      <div class="footer">
        <p style="margin: 0 0 6px 0;">&copy; ${new Date().getFullYear()} ${tenantName} &bull; Powered by Dental AI Receptionist</p>
        <p style="margin: 0;">This is an authoritative transactional security notice from the Dental AI Platform.</p>
      </div>
    </div>
  </div>
</body>
</html>
`.trim();

    return { subject, html, text };
  }
}
