import type { INestApplication } from '@nestjs/common';
import {
  DocumentBuilder,
  SwaggerModule,
  getSchemaPath,
  type OpenAPIObject,
} from '@nestjs/swagger';
import type { OperationObject } from '@nestjs/swagger/dist/interfaces/open-api-spec.interface';

import {
  DOC_PUBLIC,
  DOC_RULE,
  type PermissionRule,
} from '../access/decorators';
import { ApiErrorDto } from '../common/dto/api-error.dto';

/** Swagger UI at /api/v1/docs, the JSON the apps generate their types from at /api/v1/docs-json. */
export const DOCS_PATH = 'docs';

const METHODS = ['get', 'post', 'put', 'patch', 'delete'] as const;

const errorResponse = (description: string) => ({
  content: {
    'application/json': { schema: { $ref: getSchemaPath(ApiErrorDto) } },
  },
  description,
});

function describeRule(rule: PermissionRule) {
  if (rule.mode === 'app')
    return `Cần quyền vào ${rule.app === 'admin' ? 'trang quản trị' : 'màn hình xưởng'}.`;
  const keys = rule.keys.map((key) => `\`${key}\``).join(', ');
  return rule.mode === 'all'
    ? `Cần quyền: ${keys}.`
    : `Cần một trong: ${keys}.`;
}

/**
 * Fills in what the decorators cannot say on their own: who may call each operation (from
 * @Public / @RequirePermissions), the error answers, and a tag per resource.
 */
function finish(document: OpenAPIObject) {
  for (const [path, item] of Object.entries(document.paths)) {
    const tag = path.split('/')[1] || 'app';
    for (const method of METHODS) {
      const operation = item[method] as
        (OperationObject & Record<string, unknown>) | undefined;
      if (!operation) continue;

      const isPublic = operation[DOC_PUBLIC] === true;
      const rule = operation[DOC_RULE] as PermissionRule | undefined;
      delete operation[DOC_PUBLIC];
      delete operation[DOC_RULE];

      if (!operation.tags?.length) operation.tags = [tag];
      operation.security = isPublic ? [] : [{ bearer: [] }];
      const note = isPublic
        ? 'Không cần đăng nhập.'
        : rule
          ? describeRule(rule)
          : 'Cần đăng nhập.';
      operation.description = [operation.description, note]
        .filter(Boolean)
        .join('\n\n');

      operation.responses ??= {};
      operation.responses['400'] ??= errorResponse('Dữ liệu không hợp lệ');
      operation.responses['429'] ??= errorResponse('Thử quá nhiều lần');
      if (!isPublic) {
        operation.responses['401'] ??= errorResponse('Chưa đăng nhập');
        operation.responses['403'] ??= errorResponse('Không có quyền');
      }
    }
  }
  return document;
}

/**
 * The API description. Paths are written without the /api/v1 prefix (the server URL carries it),
 * so they match how the apps call the backend: BACKEND_URL + "/auth/login".
 */
export function buildOpenApi(app: INestApplication, prefix: string) {
  const config = new DocumentBuilder()
    .setTitle('S-3D API')
    .setDescription(
      'API dùng chung cho Web, App, Admin và Xưởng. Mọi câu trả lời có dạng ' +
        '`{ success, data, message?, messageCode? }`; lỗi có dạng `ApiErrorDto`.',
    )
    .setVersion('0.2.0')
    .addServer(`/${prefix}`)
    .addBearerAuth(
      { bearerFormat: 'JWT', scheme: 'bearer', type: 'http' },
      'bearer',
    )
    .build();

  const document = SwaggerModule.createDocument(app, config, {
    extraModels: [ApiErrorDto],
    ignoreGlobalPrefix: true,
    // Readable names in the generated clients: "Auth_login" instead of "AuthController_login".
    operationIdFactory: (controller, method) =>
      `${controller.replace(/Controller$/, '')}_${method}`,
  });
  return finish(document);
}

export function setupOpenApi(app: INestApplication, prefix: string) {
  const document = buildOpenApi(app, prefix);
  SwaggerModule.setup(`${prefix}/${DOCS_PATH}`, app, document, {
    jsonDocumentUrl: `${prefix}/${DOCS_PATH}-json`,
    customSiteTitle: 'S-3D API',
  });
}
