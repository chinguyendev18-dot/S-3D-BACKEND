import { createHash } from 'node:crypto';

import type { ConfigService } from '@nestjs/config';

import { RateLimiter } from '../common/rate-limiter';
import type { SupabaseService } from '../supabase/supabase.service';
import type { AuthService } from './auth.service';
import { OAuthService } from './oauth.service';

function setup(enabled = true) {
  const supabase = {
    authApi: jest.fn(),
    providerEnabled: jest.fn().mockResolvedValue(enabled),
    url: 'https://project.supabase.co',
  };
  const auth = {
    completeSignIn: jest.fn().mockResolvedValue({ accessToken: 'a' }),
  };
  const config = { get: () => 'http://localhost:3000,http://localhost:3001' };
  const service = new OAuthService(
    supabase as unknown as SupabaseService,
    auth as unknown as AuthService,
    new RateLimiter(),
    config as unknown as ConfigService,
  );
  return { auth, service, supabase };
}

const back = 'http://localhost:3000/api/auth/oauth/callback';

describe('OAuthService', () => {
  it('sends to Supabase with a PKCE challenge of the verifier it hands back', async () => {
    const { service } = setup();
    const { codeVerifier, url } = await service.start(
      { provider: 'google', redirectTo: back },
      {},
    );
    const params = new URL(url).searchParams;
    expect(
      url.startsWith('https://project.supabase.co/auth/v1/authorize?'),
    ).toBe(true);
    expect(params.get('provider')).toBe('google');
    expect(params.get('redirect_to')).toBe(back);
    expect(params.get('code_challenge_method')).toBe('s256');
    expect(params.get('code_challenge')).toBe(
      createHash('sha256').update(codeVerifier).digest('base64url'),
    );
  });

  it('says so when the provider is not switched on in Supabase', async () => {
    const { service } = setup(false);
    await expect(
      service.start({ provider: 'google', redirectTo: back }, {}),
    ).rejects.toMatchObject({
      messageCode: 'AUTH.SOCIAL.DISABLED',
    });
  });

  it('never sends people back to another site', async () => {
    const { service } = setup();
    await expect(
      service.start(
        { provider: 'google', redirectTo: 'https://evil.example/callback' },
        {},
      ),
    ).rejects.toMatchObject({ messageCode: 'AUTH.OAUTH.REDIRECT_NOT_ALLOWED' });
  });

  it('refuses a code Supabase does not accept', async () => {
    const { auth, service, supabase } = setup();
    supabase.authApi.mockResolvedValue({
      data: null,
      error: { code: 'flow_state_not_found', message: '' },
      status: 404,
    });
    await expect(
      service.exchange({ code: 'code-1234', codeVerifier: 'v'.repeat(64) }, {}),
    ).rejects.toMatchObject({ messageCode: 'AUTH.SOCIAL.FAILED' });
    expect(auth.completeSignIn).not.toHaveBeenCalled();
  });

  it('signs in with the session the code opens', async () => {
    const { auth, service, supabase } = setup();
    const session = {
      access_token: 'a',
      user: { app_metadata: { provider: 'google' }, id: 'u1' },
    };
    supabase.authApi.mockResolvedValue({
      data: session,
      error: null,
      status: 200,
    });
    await service.exchange(
      { code: 'code-1234', codeVerifier: 'v'.repeat(64) },
      {},
    );
    expect(supabase.authApi).toHaveBeenCalledWith('/token?grant_type=pkce', {
      body: { auth_code: 'code-1234', code_verifier: 'v'.repeat(64) },
      method: 'POST',
    });
    expect(auth.completeSignIn).toHaveBeenCalledWith(session, 'Google', {});
  });
});
