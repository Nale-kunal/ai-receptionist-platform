/**
 * Prompt Variable Resolver Service
 *
 * Safe, strict whitelist-based {{variable}} interpolation.
 * Validates all variables before resolve. Rejects unknown variables.
 */

import {
  ALLOWED_PROMPT_VARIABLES,
  MAX_PROMPT_CONTENT_LENGTH,
  BLOCKED_CONTENT_PATTERNS,
} from '../constants/prompt-engine.constants';
import {
  PromptVariableError,
  PromptContentTooLargeError,
  PromptSecretLeakError,
} from '../errors/prompt-engine.errors';
import type { PromptVariableMap, PromptValidationResult } from '../types/prompt-engine.types';

// Regex to find all {{variable}} occurrences
const VARIABLE_PATTERN = /\{\{([^{}]+)\}\}/g;
// Regex to find malformed {{ without closing }}
const MALFORMED_OPEN_PATTERN = /\{\{[^}]*$/gm;
// Regex to find empty {{}}
const EMPTY_VARIABLE_PATTERN = /\{\{\s*\}\}/g;

export class PromptVariableResolverService {
  /**
   * Resolves all {{variable}} placeholders in a template string.
   * Variables not present in the map are replaced with an empty string
   * (safe degradation — callers supply all required variables).
   * Throws PromptVariableError if an unknown (non-whitelisted) variable is encountered.
   */
  public resolve(template: string, variables: PromptVariableMap): string {
    // Security: check for blocked content patterns
    this.assertNoSecretLeak(template);

    // Reset pattern lastIndex before iterating
    VARIABLE_PATTERN.lastIndex = 0;

    return template.replace(VARIABLE_PATTERN, (match, varName) => {
      const token = `{{${varName}}}`;
      if (!ALLOWED_PROMPT_VARIABLES.has(token)) {
        throw new PromptVariableError(token, 'Variable is not on the approved whitelist.');
      }
      const key = varName.trim() as keyof PromptVariableMap;
      return variables[key] ?? '';
    });
  }

  /**
   * Validates a prompt template string before it is published.
   * Returns all validation errors (not just the first one).
   * Does NOT throw — returns a result object.
   */
  public validate(content: string, declaredVariables: string[]): PromptValidationResult {
    const errors: PromptValidationResult['errors'] = [];

    // 1. Length check
    if (content.length > MAX_PROMPT_CONTENT_LENGTH) {
      errors.push({
        code: 'CONTENT_TOO_LARGE',
        message: `Content length ${content.length} exceeds maximum of ${MAX_PROMPT_CONTENT_LENGTH} characters.`,
      });
    }

    // 2. Check for empty {{}} variables
    if (EMPTY_VARIABLE_PATTERN.test(content)) {
      errors.push({
        code: 'EMPTY_VARIABLE',
        message: 'Content contains an empty variable placeholder {{}}.',
      });
    }

    // 3. Check for malformed {{ without closing }}
    if (MALFORMED_OPEN_PATTERN.test(content)) {
      errors.push({
        code: 'MALFORMED_VARIABLE',
        message: 'Content contains a malformed variable placeholder {{ without closing }}.',
      });
    }

    // 4. Check all used {{variables}} are on the whitelist
    VARIABLE_PATTERN.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = VARIABLE_PATTERN.exec(content)) !== null) {
      const token = `{{${match[1]}}}`;
      if (!ALLOWED_PROMPT_VARIABLES.has(token)) {
        errors.push({
          code: 'UNKNOWN_VARIABLE',
          message: `Variable '${token}' is not on the approved whitelist.`,
          variable: token,
        });
      }
    }

    // 5. Declared variables must be a subset of the whitelist
    for (const declared of declaredVariables) {
      const token = declared.startsWith('{{') ? declared : `{{${declared}}}`;
      if (!ALLOWED_PROMPT_VARIABLES.has(token)) {
        errors.push({
          code: 'DECLARED_UNKNOWN_VARIABLE',
          message: `Declared variable '${token}' is not on the approved whitelist.`,
          variable: token,
        });
      }
    }

    // 6. Secret / credential pattern check
    for (const pattern of BLOCKED_CONTENT_PATTERNS) {
      if (pattern.test(content)) {
        errors.push({
          code: 'SECRET_LEAK_DETECTED',
          message: 'Content contains a pattern that resembles a secret or API credential.',
        });
        break; // One error is sufficient for this class
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Throws immediately if content matches a blocked pattern.
   * Used as a fast-path security check in resolve().
   */
  private assertNoSecretLeak(content: string): void {
    for (const pattern of BLOCKED_CONTENT_PATTERNS) {
      if (pattern.test(content)) {
        throw new PromptSecretLeakError();
      }
    }
  }
}
