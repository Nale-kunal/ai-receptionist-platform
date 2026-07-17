/**
 * AI Tool Pipeline Constants
 */

export const TOOL_CATEGORY_APPOINTMENTS  = 'appointments' as const;
export const TOOL_CATEGORY_PATIENTS      = 'patients' as const;
export const TOOL_CATEGORY_DOCTORS       = 'doctors' as const;
export const TOOL_CATEGORY_CLINIC        = 'clinic' as const;
export const TOOL_CATEGORY_CONVERSATION  = 'conversation' as const;
export const TOOL_CATEGORY_NOTIFICATIONS = 'notifications' as const;
export const TOOL_CATEGORY_GENERAL       = 'general' as const;

export const TOOL_CATEGORIES = [
  TOOL_CATEGORY_APPOINTMENTS,
  TOOL_CATEGORY_PATIENTS,
  TOOL_CATEGORY_DOCTORS,
  TOOL_CATEGORY_CLINIC,
  TOOL_CATEGORY_CONVERSATION,
  TOOL_CATEGORY_NOTIFICATIONS,
  TOOL_CATEGORY_GENERAL,
] as const;

export type ToolCategory = (typeof TOOL_CATEGORIES)[number];

// ---------------------------------------------------------------------------
// Circuit Breaker Defaults
// ---------------------------------------------------------------------------
export const DEFAULT_BREAKER_FAILURE_THRESHOLD = 5;      // Trip after 5 failures
export const DEFAULT_BREAKER_RESET_TIMEOUT_MS  = 10000;  // Open state duration: 10s
export const DEFAULT_BREAKER_HALF_OPEN_TRIALS   = 3;      // 3 successful trials to reset

// ---------------------------------------------------------------------------
// Rate Limiting Defaults
// ---------------------------------------------------------------------------
export const DEFAULT_RATE_LIMIT_WINDOWS_MS       = 60000; // 1 minute
export const DEFAULT_RATE_LIMIT_MAX_PER_WINDOW   = 30;    // 30 calls/minute

// ---------------------------------------------------------------------------
// Timeout Bounds
// ---------------------------------------------------------------------------
export const DEFAULT_TOOL_TIMEOUT_MS = 5000; // Hard timeout: 5s
