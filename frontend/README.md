# Enterprise Frontend Dashboard

This is the front-end operating system dashboard for managing AI receptionists, patient scheduling, and real-time conversation analysis.

## Key Features

- **RBAC Protected Routing**: Guards and widgets only render if the authenticated user possesses the specific permissions (`receptionist`, `doctor`, `admin`, `super_admin`).
- **Interactive Live Call Console**: Real-time mock transcription logs of active phone lines, duration trackings, and current speakers.
- **Appointments Management**: Interactive tables to schedule appointments, reschedule parameters, or trigger cancellations.
- **Prompt Control**: Full revision draft registries to view drafts, publish updates, or rollback prompts.
- **Knowledge Base (FAQs)**: Add FAQs that the AI Receptionist references dynamically during phone conversations.
- **Zero-Server Interactive Mode**: Real-time network simulator automatically fallbacks to local storage mock data if a local server is offline, making the UI fully interactive.

## Running Locally

To run the development server locally:
```bash
npm run dev
```

To build the production-ready optimized assets bundle:
```bash
npm run build
```
