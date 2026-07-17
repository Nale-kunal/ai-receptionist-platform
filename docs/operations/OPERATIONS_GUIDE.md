# Enterprise Operations & Runbook Guide

This operations guide outlines the production deployment, scaling, backup, monitoring, and upgrade runbooks for the AI Receptionist platform.

---

## 1. Deployment Architecture

The platform runs as a Dockerized container stack:
1. **Telephony Inbound**: Twilio connects to `voice-server` instances via secure WebSockets.
2. **Backend Services**: Express APIs serving CRUD, configurations, and schedules.
3. **Database Layer**: Managed PostgreSQL cluster (Multi-AZ) with PgBouncer.
4. **Cache & Queues**: Redis cluster for session locks, tokens, and rate limits.

---

## 2. Horizontal Scaling Strategy

- **Voice Server instances**: Stateless, scaled horizontally using a load balancer (ALB) supporting sticky WebSocket sessions.
- **Backend API instances**: Auto-scaled using CPU/memory threshold triggers.

---

## 3. Database Migration & Backups

- **Migrations**: Executed during deployment pipelines via `npx prisma migrate deploy`.
- **Backups**: Daily automated snapshots, retained for 30 days. Write logs are streamed to offsite S3 buckets.

---

## 4. Secret Management & Compliance

- Never store secrets or API keys in repository source codes.
- Use HashiCorp Vault or AWS Secrets Manager.
- Ensure all caller IDs and patient PHI parameters are masked in metrics and system log outputs.
