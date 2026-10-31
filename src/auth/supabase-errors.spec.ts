import { AppException } from '../common/app-exception';
import { fromSupabase } from './supabase-errors';

const supabaseError = (code: string, message: string) =>
  Object.assign(new Error(message), { code });

const fallback = () => new AppException(400, 'FALLBACK', 'fallback');

describe('fromSupabase', () => {
  it('asks to wait the seconds Supabase gives when the same address asks again too soon', () => {
    const error = fromSupabase(
      supabaseError(
        'over_email_send_rate_limit',
        'For security purposes, you can only request this after 47 seconds.',
      ),
      fallback,
    );
    expect(error).toMatchObject({
      messageCode: 'AUTH.EMAIL.RATE_LIMIT',
      retryAfterSeconds: 47,
    });
    expect(error.message).toContain('47 giây');
  });

  it('explains the hourly email limit of the built-in mailer', () => {
    const error = fromSupabase(
      supabaseError('over_email_send_rate_limit', 'email rate limit exceeded'),
      fallback,
    );
    expect(error.messageCode).toBe('AUTH.EMAIL.RATE_LIMIT');
    expect(error.message).toContain('trong giờ này');
  });

  it('reports a mailer that cannot send (Supabase SMTP settings) apart from network trouble', () => {
    const failed = Object.assign(
      new Error('Error sending confirmation email'),
      {
        name: 'AuthRetryableFetchError',
        status: 500,
      },
    );
    expect(fromSupabase(failed, fallback)).toMatchObject({
      messageCode: 'AUTH.EMAIL.SEND_FAILED',
      status: 502,
    });
    const offline = Object.assign(new Error('fetch failed'), {
      name: 'AuthRetryableFetchError',
    });
    expect(fromSupabase(offline, fallback).messageCode).toBe(
      'AUTH.PROVIDER_UNAVAILABLE',
    );
  });

  it('leaves unknown answers to the caller', () => {
    expect(
      fromSupabase(supabaseError('something_else', ''), fallback).messageCode,
    ).toBe('FALLBACK');
  });
});
