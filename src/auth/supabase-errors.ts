import { HttpStatus, Logger } from '@nestjs/common';

import { AppException } from '../common/app-exception';

const codeOf = (error: unknown) =>
  error &&
  typeof error === 'object' &&
  'code' in error &&
  typeof error.code === 'string'
    ? error.code
    : '';

const nameOf = (error: unknown) => (error instanceof Error ? error.name : '');
const messageOf = (error: unknown) =>
  error instanceof Error ? error.message : '';

const logger = new Logger('SupabaseAuth');

/**
 * Supabase refused to send another email. Either the same address asked again too soon ("you
 * can only request this after N seconds"), or the project used up its emails for the hour: the
 * built-in mailer sends only a few per hour for the whole project, until custom SMTP is set up.
 */
function emailRateLimit(error: unknown) {
  const seconds = Number(/after (\d+) seconds?/i.exec(messageOf(error))?.[1]);
  if (seconds > 0) {
    return new AppException(
      HttpStatus.TOO_MANY_REQUESTS,
      'AUTH.EMAIL.RATE_LIMIT',
      `Vui lòng đợi ${seconds} giây rồi bấm gửi lại mã.`,
      undefined,
      seconds,
    );
  }
  return new AppException(
    HttpStatus.TOO_MANY_REQUESTS,
    'AUTH.EMAIL.RATE_LIMIT',
    'Hệ thống đã gửi hết số email cho phép trong giờ này nên chưa gửi được mã. Vui lòng thử lại sau.',
  );
}

/**
 * Supabase Auth's answers that mean the same thing whatever was being done; anything else is
 * left to the caller's `fallback`, which knows the step (wrong password, wrong code...).
 */
export function fromSupabase(
  error: unknown,
  fallback: () => AppException,
): AppException {
  if (nameOf(error) === 'AuthRetryableFetchError') {
    // Supabase answers 500 "Error sending confirmation / recovery email" when its SMTP settings
    // fail (wrong host or password): not a network problem, and the shop must fix its mailer.
    if (/error sending .*email/i.test(messageOf(error))) {
      logger.error(`Supabase could not send an email: ${messageOf(error)}`);
      return new AppException(
        HttpStatus.BAD_GATEWAY,
        'AUTH.EMAIL.SEND_FAILED',
        'Hiện chưa gửi được email chứa mã. Vui lòng thử lại sau ít phút hoặc liên hệ cửa hàng.',
      );
    }
    return new AppException(
      HttpStatus.SERVICE_UNAVAILABLE,
      'AUTH.PROVIDER_UNAVAILABLE',
      'Chưa kết nối được máy chủ đăng nhập. Vui lòng thử lại.',
    );
  }

  switch (codeOf(error)) {
    case 'over_request_rate_limit':
      return new AppException(
        HttpStatus.TOO_MANY_REQUESTS,
        'AUTH.TOO_MANY_REQUESTS',
        'Đã gửi quá nhiều yêu cầu. Vui lòng thử lại sau ít phút.',
      );
    case 'over_email_send_rate_limit':
      return emailRateLimit(error);
    case 'email_address_not_authorized':
      // Supabase's built-in mailer only writes to the project's own team until SMTP is set up.
      return new AppException(
        HttpStatus.BAD_REQUEST,
        'AUTH.EMAIL.NOT_CONFIGURED',
        'Cửa hàng chưa cấu hình máy chủ email nên chưa gửi được mã tới địa chỉ này.',
      );
    case 'email_address_invalid':
      return new AppException(
        HttpStatus.BAD_REQUEST,
        'VALIDATION_ERROR',
        'Email không hợp lệ.',
      );
    case 'weak_password':
      return new AppException(
        HttpStatus.BAD_REQUEST,
        'AUTH.PASSWORD.WEAK',
        'Mật khẩu quá yếu. Hãy dùng mật khẩu dài hơn, có cả chữ và số.',
      );
    case 'same_password':
      return new AppException(
        HttpStatus.BAD_REQUEST,
        'AUTH.PASSWORD.SAME_PASSWORD',
        'Mật khẩu mới phải khác mật khẩu đang dùng.',
      );
    case 'user_banned':
      return new AppException(
        HttpStatus.FORBIDDEN,
        'AUTH.LOGIN.ACCOUNT_DISABLED',
        'Tài khoản đã bị khoá. Vui lòng liên hệ quản trị viên.',
      );
    case 'signup_disabled':
      return new AppException(
        HttpStatus.FORBIDDEN,
        'AUTH.REGISTER.DISABLED',
        'Cửa hàng đang tạm ngừng nhận đăng ký mới.',
      );
    default:
      return fallback();
  }
}

export const supabaseCode = codeOf;
