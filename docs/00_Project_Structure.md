# Project Structure

Project: AI Receptionist SaaS Platform

Version: 1.0.0

Status: Active

Authority: Repository Structure

---

# Purpose

This document defines the complete repository structure for the AI Receptionist SaaS Platform.

Every directory has a single responsibility.

The repository structure SHALL remain consistent throughout the lifetime of the project.

---

# Repository Layout

```text
ai-receptionist-platform/

├── backend/
├── frontend/
├── voice-server/
├── docs/
├── docker/
├── infrastructure/
├── scripts/
├── tests/
├── .github/
├── .vscode/
├── .gitignore
├── README.md
├── LICENSE
└── docker-compose.yml
```

---

# Backend

```text
backend/

src/

modules/

shared/

config/

database/

middleware/

events/

queues/

providers/

utils/

types/

tests/

prisma/

scripts/

package.json

tsconfig.json
```

---

# Backend Module Layout

Every module SHALL follow exactly this structure.

```text
module-name/

controllers/

services/

repositories/

validators/

dto/

interfaces/

routes/

events/

errors/

constants/

types/

tests/

README.md

index.ts
```

---

# Shared

```text
shared/

auth/

errors/

logger/

events/

constants/

interfaces/

validators/

security/

cache/

utils/
```

---

# Config

```text
config/

app/

database/

providers/

security/

validation/

index.ts
```

---

# Database

```text
database/

migrations/

seed/

factories/

prisma/

backups/
```

---

# Providers

```text
providers/

openai/

twilio/

calendar/

smtp/
```

Future providers will be added here without changing module code.

---

# Frontend

```text
frontend/

src/

app/

assets/

components/

contexts/

features/

hooks/

layouts/

pages/

routes/

services/

store/

styles/

types/

utils/

tests/
```

---

# Frontend Feature Layout

```text
feature/

components/

pages/

hooks/

services/

types/

validation/

tests/

index.ts
```

---

# Voice Server

```text
voice-server/

src/

adapters/

providers/

sessions/

streaming/

audio/

events/

services/

middleware/

config/

types/

tests/
```

---

# Documentation

```text
docs/

architecture/

engineering-playbook/

implementation-contracts/

requirements/

security/

00_Engineering_Constitution.md

PLATFORM_MANIFEST.md
```

---

# Docker

```text
docker/

backend/

frontend/

voice/

postgres/

nginx/
```

---

# Infrastructure

```text
infrastructure/

render/

terraform/ (future)

kubernetes/ (future)

nginx/

monitoring/
```

---

# Scripts

```text
scripts/

setup/

build/

deploy/

backup/

restore/

seed/

lint/

format/
```

---

# Testing

```text
tests/

integration/

e2e/

performance/

security/

fixtures/
```

---

# GitHub

```text
.github/

workflows/

ISSUE_TEMPLATE/

PULL_REQUEST_TEMPLATE/

CODEOWNERS
```

---

# Environment Files

```text
.env.example

backend/.env.example

frontend/.env.example

voice-server/.env.example
```

Production secrets SHALL NEVER exist inside the repository.

---

# Naming Rules

Directories

kebab-case

Files

PascalCase where appropriate

Variables

camelCase

Classes

PascalCase

Constants

UPPER_SNAKE_CASE

---

# Import Rules

Modules SHALL import only through public interfaces.

Relative imports across modules are prohibited.

Shared functionality belongs in the shared directory.

---

# Ownership

Each folder has exactly one responsibility.

Business logic SHALL remain inside backend modules.

Frontend SHALL never duplicate backend logic.

Voice Server SHALL never implement business rules.

---

# Future Expansion

The structure SHALL support:

Analytics

Billing

Subscriptions

Marketplace

Additional AI providers

Additional telephony providers

Additional frontend applications

Mobile applications

without restructuring the repository.

---

# Definition of Done

The project structure is complete when:

Repository created

Directories created

Naming conventions followed

Shared modules established

Documentation placed correctly

Environment templates added

Repository ready for implementation

---

# Guiding Principle

A predictable repository structure improves maintainability, onboarding, testing, automation, and long-term scalability.

Every file should have one clear home.