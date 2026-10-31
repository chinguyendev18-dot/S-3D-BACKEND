import {
  HttpStatus,
  ValidationPipe,
  type ValidationError,
} from '@nestjs/common';

import { AppException } from './app-exception';

/** class-validator's own English messages (where a DTO gives none), in the apps' language. */
const DEFAULT_MESSAGES: Array<[RegExp, (match: RegExpMatchArray) => string]> = [
  [
    /^property (\S+) should not exist$/,
    (m) => `Trường “${m[1]}” không được gửi lên.`,
  ],
  [
    /must be shorter than or equal to (\d+) characters$/,
    (m) => `Tối đa ${m[1]} ký tự.`,
  ],
  [
    /must be longer than or equal to (\d+) characters$/,
    (m) => `Cần ít nhất ${m[1]} ký tự.`,
  ],
  [/must be a string$/, () => 'Phải là chữ.'],
  [/must be a boolean value$/, () => 'Phải là đúng hoặc sai.'],
  [/must be an array$/, () => 'Phải là một danh sách.'],
  [/must be a UUID$/, () => 'Mã không hợp lệ.'],
  [/must not be greater than (\d+)$/, (m) => `Không được lớn hơn ${m[1]}.`],
  [/must not be less than (\d+)$/, (m) => `Không được nhỏ hơn ${m[1]}.`],
  [/must be an integer number$/, () => 'Phải là số nguyên.'],
];

function translate(message: string) {
  for (const [pattern, text] of DEFAULT_MESSAGES) {
    const match = message.match(pattern);
    if (match) return text(match);
  }
  return message;
}

function collect(
  errors: ValidationError[],
  parent = '',
  out: Record<string, string[]> = {},
) {
  for (const error of errors) {
    const field = parent ? `${parent}.${error.property}` : error.property;
    const messages = Object.values(error.constraints ?? {}).map(translate);
    if (messages.length) out[field] = messages;
    if (error.children?.length) collect(error.children, field, out);
  }
  return out;
}

/**
 * DTOs only: unknown fields are refused, values are converted to their declared types, and the
 * apps get the problems per field in `details`.
 */
export function createValidationPipe() {
  return new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
    exceptionFactory: (errors) => {
      const details = collect(errors);
      // A field's own message ("Nhập mật khẩu.") says more than a length rule: show it first.
      const messages = Object.values(details).flat();
      const first =
        messages.find((message) => !/^(Tối đa|Cần ít nhất)/.test(message)) ??
        messages[0] ??
        'Dữ liệu gửi lên chưa hợp lệ.';
      return new AppException(
        HttpStatus.BAD_REQUEST,
        'VALIDATION_ERROR',
        first,
        details,
      );
    },
  });
}
