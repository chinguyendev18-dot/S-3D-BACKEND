import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { clientOrigins } from './common/client-origins';

/**
 * Which proxies may report the visitor's address (X-Forwarded-For), in Express's "trust proxy"
 * form: "loopback" (the web apps on this machine), a hop count behind a load balancer, or
 * addresses/subnets separated by commas.
 */
function trustProxy(value: string): boolean | number | string {
  if (/^\d+$/.test(value)) return Number(value);
  if (value === 'true' || value === 'false') return value === 'true';
  return value;
}

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const config = app.get(ConfigService);
  const port = config.get<number>('PORT', 4000);
  const apiPrefix = config.get<string>('API_PREFIX', 'api/v1');

  app.set('trust proxy', trustProxy(config.get('TRUST_PROXY', 'loopback')));
  app.setGlobalPrefix(apiPrefix);
  app.enableCors({
    origin: clientOrigins(config),
    credentials: true,
  });
  // Validation, guards, the response shape and errors are set up in AppModule, so the e2e tests
  // get them too.
  app.enableShutdownHooks();

  // No host: listens on IPv6 and IPv4 together. On 0.0.0.0 only, every call to "localhost"
  // (which tries ::1 first) waited 100-200 ms before falling back to IPv4.
  await app.listen(port);
  console.log(
    `S-3D Backend is running at http://localhost:${port}/${apiPrefix}`,
  );
}

void bootstrap();
