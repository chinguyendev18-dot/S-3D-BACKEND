import type { ConfigService } from '@nestjs/config';

/** The apps' addresses in development: web 3000, admin 3001, workshop 3002, Expo web 8081. */
const DEFAULT_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:3002',
  'http://localhost:8081',
];

/** CLIENT_ORIGINS: who may call the API (CORS) and where sign-in may send people back to. */
export function clientOrigins(config: ConfigService) {
  return config
    .get<string>('CLIENT_ORIGINS', DEFAULT_ORIGINS.join(','))
    .split(',')
    .map((origin) => origin.trim().replace(/\/$/, ''))
    .filter(Boolean);
}
