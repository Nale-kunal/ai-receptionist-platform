/**
 * OpenAI Realtime Provider Module Barrel Export
 *
 * IMPORTANT: Only the provider class is exported.
 * Internal types, handlers, and protocol-level shapes are NOT exported.
 * This enforces ADR-0017: raw provider event types never cross module boundaries.
 */

export { OpenAiRealtimeProvider } from './openai-realtime.provider';
