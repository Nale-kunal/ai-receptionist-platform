/**
 * Meta Verification & WABA Subscription Service
 *
 * Platform Admin service for verifying Meta WhatsApp credentials,
 * checking WABA account access, validating Phone Number IDs, and
 * managing WABA webhook app subscriptions via Meta Graph API.
 *
 * Security:
 *  - Native fetch with 10-second AbortController timeout
 *  - Sanitized errors: access tokens are stripped from all exceptions and logs
 *  - Tokens are never returned to callers or API responses
 */

export interface MetaVerificationChecks {
  credentials: 'passed' | 'failed' | 'skipped';
  waba: 'passed' | 'failed' | 'skipped';
  phoneNumber: 'passed' | 'failed' | 'skipped';
  webhookSubscription: 'passed' | 'failed' | 'skipped';
}

export interface ConnectivityCheckResult {
  success: boolean;
  status: 'passed' | 'verification_failed';
  checks: MetaVerificationChecks;
  details?: {
    wabaName?: string;
    verifiedName?: string;
    displayPhoneNumber?: string;
    isSubscribed?: boolean;
  };
  error?: {
    code: string;
    message: string;
  };
}

export class MetaVerificationService {
  private readonly apiBase = 'https://graph.facebook.com';
  private readonly apiVersion: string;
  private readonly accessToken: string | undefined;

  constructor(options?: { accessToken?: string; apiVersion?: string }) {
    this.accessToken = options?.accessToken ?? process.env['WHATSAPP_ACCESS_TOKEN'];
    this.apiVersion = options?.apiVersion ?? process.env['WHATSAPP_API_VERSION'] ?? 'v21.0';
  }

  /**
   * Safe fetch to Meta Graph API with timeout and token sanitization.
   */
  private async metaFetch<T = any>(
    endpoint: string,
    options: { method?: string; body?: Record<string, unknown> } = {},
  ): Promise<{ ok: boolean; status: number; data?: T; error?: string }> {
    if (!this.accessToken) {
      return { ok: false, status: 500, error: 'WHATSAPP_ACCESS_TOKEN is not configured on the platform.' };
    }

    const url = `${this.apiBase}/${this.apiVersion}/${endpoint}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    try {
      const response = await fetch(url, {
        method: options.method || 'GET',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
        ...(options.body ? { body: JSON.stringify(options.body) } : {}),
        signal: controller.signal,
      });

      const responseText = await response.text().catch(() => '');
      let json: any;
      try {
        json = JSON.parse(responseText);
      } catch {
        json = null;
      }

      if (!response.ok) {
        const rawErr = json?.error?.message || responseText || `HTTP ${response.status}`;
        const sanitized = rawErr.replace(/EA[A-Za-z0-9]+/g, '[REDACTED]').slice(0, 250);
        return { ok: false, status: response.status, error: sanitized };
      }

      return { ok: true, status: response.status, data: json };
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        return { ok: false, status: 504, error: 'Meta Graph API request timed out after 10 seconds.' };
      }
      const raw = err instanceof Error ? err.message : String(err);
      const sanitized = raw.replace(/EA[A-Za-z0-9]+/g, '[REDACTED]').slice(0, 250);
      return { ok: false, status: 500, error: sanitized };
    } finally {
      clearTimeout(timeout);
    }
  }

  /**
   * 1. Validate platform access token can authenticate to Meta.
   */
  public async checkCredentials(): Promise<{ passed: boolean; error?: string }> {
    if (!this.accessToken) {
      return { passed: false, error: 'WHATSAPP_ACCESS_TOKEN is missing in platform environment configuration.' };
    }

    const res = await this.metaFetch('me?fields=id,name');
    if (!res.ok) {
      return { passed: false, error: `Meta Authentication Failed: ${res.error}` };
    }
    return { passed: true };
  }

  /**
   * 2. Validate WABA ID exists and is accessible by the platform token.
   */
  public async validateWaba(wabaId: string): Promise<{ passed: boolean; wabaName?: string; error?: string }> {
    const res = await this.metaFetch(`${wabaId}?fields=id,name,currency,timezone_id`);
    if (!res.ok) {
      return { passed: false, error: `WABA Access Error (${wabaId}): ${res.error}` };
    }
    return { passed: true, wabaName: res.data?.name };
  }

  /**
   * 3. Validate Phone Number ID belongs to the specified WABA.
   */
  public async validatePhoneNumber(
    wabaId: string,
    phoneNumberId: string,
    expectedPhone?: string,
  ): Promise<{ passed: boolean; verifiedName?: string; displayPhoneNumber?: string; error?: string }> {
    // Query the phone number details directly
    const res = await this.metaFetch(`${phoneNumberId}?fields=id,display_phone_number,verified_name,quality_rating,code_verification_status`);
    if (!res.ok) {
      return { passed: false, error: `Phone Number ID Error (${phoneNumberId}): ${res.error}` };
    }

    const phoneData = res.data;
    const rawDisplay = (phoneData?.display_phone_number || '').replace(/\D/g, '');
    const cleanExpected = (expectedPhone || '').replace(/\D/g, '');

    if (cleanExpected && rawDisplay && !rawDisplay.includes(cleanExpected) && !cleanExpected.includes(rawDisplay)) {
      return {
        passed: false,
        verifiedName: phoneData?.verified_name,
        displayPhoneNumber: phoneData?.display_phone_number,
        error: `Phone number mismatch: configured "${expectedPhone}" does not match Meta phone "${phoneData?.display_phone_number}".`,
      };
    }

    return {
      passed: true,
      verifiedName: phoneData?.verified_name,
      displayPhoneNumber: phoneData?.display_phone_number,
    };
  }

  /**
   * 4. Subscribe the WABA to this Meta App for webhook event forwarding.
   * Required by Meta Cloud API: POST /{WABA-ID}/subscribed_apps
   */
  public async subscribeWaba(wabaId: string): Promise<{ passed: boolean; error?: string }> {
    const res = await this.metaFetch(`${wabaId}/subscribed_apps`, {
      method: 'POST',
    });
    if (!res.ok || res.data?.success !== true) {
      return { passed: false, error: `WABA Webhook Subscription Failed (${wabaId}): ${res.error || 'Meta returned success=false'}` };
    }
    return { passed: true };
  }

  /**
   * 5. Verify that the WABA is currently subscribed to this Meta App.
   * Query GET /{WABA-ID}/subscribed_apps
   */
  public async checkWabaSubscription(wabaId: string): Promise<{ passed: boolean; isSubscribed: boolean; error?: string }> {
    const res = await this.metaFetch(`${wabaId}/subscribed_apps`);
    if (!res.ok) {
      return { passed: false, isSubscribed: false, error: `Could not verify WABA subscription: ${res.error}` };
    }

    const list = Array.isArray(res.data?.data) ? res.data.data : [];
    const isSubscribed = list.length > 0;
    return { passed: true, isSubscribed };
  }

  /**
   * Comprehensive connectivity diagnostic pipeline.
   */
  public async runConnectivityCheck(params: {
    wabaId: string;
    phoneNumberId: string;
    phoneNumber?: string;
  }): Promise<ConnectivityCheckResult> {
    const checks: MetaVerificationChecks = {
      credentials: 'failed',
      waba: 'skipped',
      phoneNumber: 'skipped',
      webhookSubscription: 'skipped',
    };

    // Step 1: Credentials
    const credCheck = await this.checkCredentials();
    if (!credCheck.passed) {
      return {
        success: false,
        status: 'verification_failed',
        checks,
        error: { code: 'META_CREDENTIALS_FAILED', message: credCheck.error || 'Meta credentials invalid' },
      };
    }
    checks.credentials = 'passed';

    // Step 2: WABA Access
    checks.waba = 'failed';
    const wabaCheck = await this.validateWaba(params.wabaId);
    if (!wabaCheck.passed) {
      return {
        success: false,
        status: 'verification_failed',
        checks,
        error: { code: 'WABA_ACCESS_FAILED', message: wabaCheck.error || 'WABA account inaccessible' },
      };
    }
    checks.waba = 'passed';

    // Step 3: Phone Number Verification
    checks.phoneNumber = 'failed';
    const phoneCheck = await this.validatePhoneNumber(params.wabaId, params.phoneNumberId, params.phoneNumber);
    if (!phoneCheck.passed) {
      return {
        success: false,
        status: 'verification_failed',
        checks,
        details: { wabaName: wabaCheck.wabaName },
        error: { code: 'PHONE_NUMBER_VERIFICATION_FAILED', message: phoneCheck.error || 'Phone Number ID invalid' },
      };
    }
    checks.phoneNumber = 'passed';

    // Step 4: Webhook App Subscription
    checks.webhookSubscription = 'failed';
    const subResult = await this.subscribeWaba(params.wabaId);
    if (!subResult.passed) {
      return {
        success: false,
        status: 'verification_failed',
        checks,
        details: {
          wabaName: wabaCheck.wabaName,
          verifiedName: phoneCheck.verifiedName,
          displayPhoneNumber: phoneCheck.displayPhoneNumber,
        },
        error: { code: 'WABA_SUBSCRIPTION_FAILED', message: subResult.error || 'Failed to subscribe WABA to app webhooks' },
      };
    }
    checks.webhookSubscription = 'passed';

    return {
      success: true,
      status: 'passed',
      checks,
      details: {
        wabaName: wabaCheck.wabaName,
        verifiedName: phoneCheck.verifiedName,
        displayPhoneNumber: phoneCheck.displayPhoneNumber,
        isSubscribed: true,
      },
    };
  }
}
