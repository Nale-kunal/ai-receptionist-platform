# Dental AI Receptionist SaaS — Production Deployment & Configuration Guide

This guide provides step-by-step instructions for deploying the **Dental AI Receptionist SaaS** to production using **Render** for the Backend API Web Service and **Vercel** for the Frontend React Application.

---

## Architecture Target

- **Backend Web Service**: Hosted on **Render** (Singapore / Region target)
  - Runtime: Node.js 20+ / Express / TypeScript
  - Root Directory: `backend`
  - Build Command: `npm install --include=dev && npx prisma generate && npm run build`
  - Start Command: `npm run start`
- **Frontend App**: Hosted on **Vercel**
  - Framework: Vite / React 19 / TypeScript
  - Root Directory: `frontend`
  - Build Command: `npm run build`
  - Output Directory: `dist`
- **Database**: External PostgreSQL instance (e.g. Neon / Supabase / AWS RDS / Aiven).

---

## 1. Backend Deployment Configuration (Render)

### Environment Variables Checklist

Configure the following environment variables in **Render Dashboard → Service → Environment**:

| Variable Name | Required? | Description & Value Format |
| :--- | :--- | :--- |
| `NODE_ENV` | **Yes** | Set strictly to `production` |
| `PORT` | **Yes** | Set to `3000` (or leave default if managed by Render) |
| `DATABASE_URL` | **Yes** | Full PostgreSQL connection URL with SSL, e.g. `postgresql://user:password@host:5432/dbname?sslmode=require` |
| `JWT_ACCESS_SECRET` | **Yes** | Cryptographically random key (32+ chars). Generate with `openssl rand -hex 32` |
| `JWT_REFRESH_SECRET` | **Yes** | Cryptographically random key (32+ chars). Generate with `openssl rand -hex 32` |
| `CALENDAR_ENCRYPTION_SECRET` | **Yes** | Cryptographically random key (32+ chars). Generate with `openssl rand -hex 32` |
| `OPENAI_API_KEY` | **Yes** | Production OpenAI API key starting with `sk-` |
| `CORS_ORIGIN` | **Yes** | Public frontend URL, e.g., `https://your-app-name.vercel.app` |
| `EMAIL_PROVIDER` | **Yes** | `disabled` (for deployments without custom email domain) or `resend` / `smtp` / `sendgrid` / `postmark` |
| `EMAIL_FROM_NAME` | **Yes** | `"Dental AI Receptionist"` |
| `EMAIL_FROM_EMAIL` | **Yes** | Sender email address (e.g. `no-reply@yourdomain.com`). *(Note: `onboarding@resend.dev` is prohibited when using live providers)* |
| `RESEND_API_KEY` | Optional** | Live Resend API key starting with `re_` (required when `EMAIL_PROVIDER=resend`) |
| `APP_NAME` | **Yes** | `"Dental AI Receptionist"` |
| `FRONTEND_URL` | **Yes** | `https://your-app-name.vercel.app` |
| `BACKEND_URL` | **Yes** | `https://dental-ai-backend-gy1y.onrender.com` |
| `WHATSAPP_APP_SECRET` | Optional* | Meta App Secret for X-Hub-Signature-256 HMAC verification |
| `WHATSAPP_ACCESS_TOKEN` | Optional* | Meta System User permanent access token for Graph API |
| `WHATSAPP_API_VERSION` | **Yes** | `v21.0` |

*\* Required when WhatsApp live integration is enabled.*
*\*\* Required when live email delivery via Resend is enabled.*

> [!NOTE]
> **Deploying with `EMAIL_PROVIDER=disabled`**:
> `EMAIL_PROVIDER=disabled` is an intentional production configuration for deployments where external email delivery or a custom domain has not yet been configured.
> When `EMAIL_PROVIDER=disabled` is set:
> - Password reset emails will **not** be externally delivered.
> - Account verification emails will **not** be externally delivered.
> - Team member invitation emails will **not** be externally delivered.
> - Practitioner email notifications will **not** be externally delivered.
> - **All core AI Voice Receptionist, WhatsApp AI Booking Engine, and Appointment Scheduling features remain 100% operational.**
> - Before enabling live email delivery (`EMAIL_PROVIDER=resend`), a verified custom domain and live provider API keys must be configured.


### Generating Production Secrets

Run this in your terminal or Node REPL to generate secure 32-byte hex keys:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## 2. Database Migrations Deployment

The production PostgreSQL database must be migrated using Prisma's non-destructive migration engine:

```bash
# Executed automatically during Render build phase or deployment pipeline
npx prisma migrate deploy
```

> [!CAUTION]
> NEVER execute `npx prisma db push` or `npx prisma migrate reset` against a production database.

---

## 3. Frontend Deployment Configuration (Vercel)

### Environment Variables Checklist

Configure in **Vercel Project Settings → Environment Variables**:

| Variable Name | Required? | Value |
| :--- | :--- | :--- |
| `VITE_API_URL` | **Yes** | `https://dental-ai-backend-gy1y.onrender.com/api/v1` |

> [!IMPORTANT]
> DO NOT include backend secrets (`JWT_ACCESS_SECRET`, `DATABASE_URL`, `OPENAI_API_KEY`, etc.) in Vercel environment variables.

---

## 4. Meta WhatsApp Webhook Setup

1. Log into **Meta Business / Developer Portal**.
2. Select your Meta App → **WhatsApp** → **Configuration**.
3. Set **Callback URL**:
   `https://dental-ai-backend-gy1y.onrender.com/api/v1/webhooks/whatsapp`
4. Set **Verify Token**: Use the `webhookVerifyToken` generated when registering the clinic's WhatsApp number in the Practice Owner UI.
5. Subscribe to Webhook fields: `messages`.

---

## 5. Health & Readiness Verification

After deployment, test the backend probes:

```bash
# Health Probe
curl -i https://dental-ai-backend-gy1y.onrender.com/health

# Readiness Probe (Database & Infrastructure check)
curl -i https://dental-ai-backend-gy1y.onrender.com/ready
```

Expected output:
- `/health`: `200 OK` → `{"status":"ok","service":"backend",...}`
- `/ready`: `200 OK` → `{"status":"ready","database":"connected"}`
