import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, type JwtPayload } from '@supabase/supabase-js';

type Client = ReturnType<typeof createClient>;

const SERVER_AUTH = {
  autoRefreshToken: false,
  detectSessionInUrl: false,
  persistSession: false,
} as const;

/** How long the switched-on providers are remembered: turning one on shows within this time. */
const SETTINGS_TTL_MS = 30_000;

export interface AuthApiReply<T> {
  data: T | null;
  error: { code: string; message: string } | null;
  status: number;
}

/**
 * Supabase Auth, seen from the server. Accounts, passwords and sessions live there; this
 * backend signs people in through it and checks the access tokens it issues.
 */
@Injectable()
export class SupabaseService {
  readonly url: string;
  /** Secret key: creates users, changes passwords, bans. Never leaves this server. */
  readonly admin: Client;
  private readonly publishableKey: string;
  private readonly verifier: Client;
  private settings: { at: number; external: Record<string, boolean> } | null =
    null;

  constructor(config: ConfigService) {
    this.url = config.get<string>('SUPABASE_URL', '').replace(/\/$/, '');
    this.publishableKey = config.get<string>('SUPABASE_PUBLISHABLE_KEY', '');
    this.admin = createClient(
      this.url,
      config.get<string>('SUPABASE_SECRET_KEY', ''),
      { auth: SERVER_AUTH },
    );
    this.verifier = this.client();
  }

  /** A fresh client for one sign-in step, so no session is ever shared between requests. */
  client(): Client {
    return createClient(this.url, this.publishableKey, { auth: SERVER_AUTH });
  }

  /**
   * A call to Supabase Auth's REST API with the publishable key, for the steps supabase-js only
   * does inside a browser (the OAuth code exchange). Network failures throw.
   */
  async authApi<T>(
    path: string,
    init: { body?: unknown; method?: string } = {},
  ): Promise<AuthApiReply<T>> {
    const response = await fetch(`${this.url}/auth/v1${path}`, {
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      headers: {
        apikey: this.publishableKey,
        'Content-Type': 'application/json',
      },
      method: init.method ?? 'GET',
      signal: AbortSignal.timeout(15_000),
    });
    const body = (await response.json().catch(() => null)) as Record<
      string,
      unknown
    > | null;
    if (response.ok)
      return { data: body as T, error: null, status: response.status };
    const text = (value: unknown) =>
      typeof value === 'string' || typeof value === 'number'
        ? String(value)
        : '';
    return {
      data: null,
      error: {
        code: text(body?.error_code) || text(body?.error) || text(body?.code),
        message:
          text(body?.msg) ||
          text(body?.message) ||
          text(body?.error_description),
      },
      status: response.status,
    };
  }

  /** Whether a sign-in provider (google, apple) is switched on in Supabase Auth. */
  async providerEnabled(provider: string) {
    if (!this.settings || Date.now() - this.settings.at > SETTINGS_TTL_MS) {
      const { data } = await this.authApi<{
        external?: Record<string, boolean>;
      }>('/settings');
      this.settings = { at: Date.now(), external: data?.external ?? {} };
    }
    return this.settings.external[provider] === true;
  }

  /**
   * The claims of a valid access token, or null. The signature is checked against the project's
   * public keys (fetched once, then cached by supabase-js), so no request per call.
   */
  async verifyAccessToken(token: string): Promise<JwtPayload | null> {
    try {
      const { data, error } = await this.verifier.auth.getClaims(token);
      if (error || !data) return null;
      const claims = data.claims;
      if (claims.iss !== `${this.url}/auth/v1`) return null;
      if (claims.role !== 'authenticated' || !claims.sub) return null;
      return claims;
    } catch {
      return null;
    }
  }
}
