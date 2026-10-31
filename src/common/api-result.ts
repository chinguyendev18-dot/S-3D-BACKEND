/**
 * What a handler returns when the apps should also get a message (and its code) beside the data.
 * Anything else a handler returns is sent as `data` alone.
 */
export class ApiResult<T> {
  constructor(
    readonly data: T,
    readonly message?: string,
    readonly messageCode?: string,
  ) {}
}

export const withMessage = <T>(
  data: T,
  message: string,
  messageCode?: string,
) => new ApiResult(data, message, messageCode);
