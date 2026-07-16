# Configuration Module

The Configuration Module handles tenant and clinic-specific runtime parameters for the AI Receptionist platform. It resolves, versions, caches, and validates business, AI, voice, branding, notifications, and calendar provider settings.

## Design Architecture

```
                                  +-----------------------+
                                  |    HTTP Middleware    |
                                  | (Tenant Resolution &  |
                                  |   Context Builder)    |
                                  +-----------+-----------+
                                              |
                                              v
                                  +-----------------------+
                                  |  ConfigurationRouter  |
                                  +-----------+-----------+
                                              |
                                              v
                                  +-----------------------+
                                  |ConfigurationController|
                                  +-----------+-----------+
                                              |
                                              v
                                  +-----------------------+
                                  | ConfigurationService  |
                                  +-----------+-----------+
                                              |
                                              v
                                  +-----------+-----------+
                                  |  ConfigurationCache   |
                                  +-----------+-----------+
                                              |
                                              v
                                  +-----------------------+
                                  |ConfigurationRepository|
                                  +-----------+-----------+
                                              |
                                              v
                                  +-----------------------+
                                  |      Prisma Client    |
                                  +-----------------------+
```

### 1. Configuration Inheritance (Tenant ➔ Clinic)
Inheritance allows clinic locations to override a tenant's base settings.
When resolving configuration:
1. Try clinic specific override: `clinicId = ? AND isActive = true`.
2. Fall back to tenant-level base: `clinicId = null AND isActive = true`.

### 2. Versioning and Rollback
Each configuration change creates a new record in the `configurations` table with an incremented `version` number. Previously active records are deactivated (`isActive = false`).
- **Rollback**: Restoring a historical version copies the historical settings block into a brand-new configuration record with an incremented version number, pointing `rollbackFromVersion` to the target. This preserves full audit capability.

### 3. Caching Strategy
To minimize database checks, resolved configurations are stored in an in-memory LRU cache (`ConfigurationCacheService`). Cache invalidation is triggered instantly upon any update or rollback.

---

## Configuration JSON Schemas

The settings are categorized into independent JSON columns:
- **Business**: Business hours, holidays, and appointment duration.
- **Voice**: Models, greetings, custom prompting, and voice languages.
- **AI**: Realtime prompt details, tone, greeting guidelines, and providers.
- **Calendar**: Google Calendar sync preferences.
- **Notification**: SMS and Email triggers.
- **Branding**: Logo URLs, website links, colors, and clinic name.
- **Localization**: Timezone, country, and language defaults.
- **FeatureFlags**: Boolean toggles for features.
- **Providers**: Credentials and settings for OpenAI, Twilio, Google Calendar, and SMTP.
