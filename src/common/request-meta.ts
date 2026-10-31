import type { Request } from 'express';

export interface RequestMeta {
  ip?: string;
  userAgent?: string;
}

/**
 * Where a request came from, for rate limits and the audit log. The web apps call through their
 * own server, which passes the visitor's address on in X-Forwarded-For. Express reads that header
 * only from the proxies TRUST_PROXY names (see main.ts): taken from anyone, a caller could send a
 * new address with every guess and never meet the per-address sign-in limit.
 */
export function requestMeta(request: Request): RequestMeta {
  const agent = request.headers['user-agent'];
  return {
    // The server listens on IPv6 too, where IPv4 visitors show as ::ffff:1.2.3.4.
    ip: request.ip?.replace(/^::ffff:/, '') || undefined,
    userAgent: agent ? agent.slice(0, 300) : undefined,
  };
}
