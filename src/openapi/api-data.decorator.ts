import { applyDecorators, type Type } from '@nestjs/common';
import { ApiExtraModels, ApiResponse, getSchemaPath } from '@nestjs/swagger';
import type {
  ReferenceObject,
  SchemaObject,
} from '@nestjs/swagger/dist/interfaces/open-api-spec.interface';

type Model = Type<unknown>;

interface DataOptions {
  /** `data` is a list of the model. */
  array?: boolean;
  description?: string;
  /** 201 for routes that create (POST without @HttpCode(200)). */
  status?: number;
}

/** Every answer is wrapped by common/response.interceptor.ts: `{ success, data, message? }`. */
function envelope(data: SchemaObject | ReferenceObject): SchemaObject {
  return {
    properties: {
      data,
      message: { type: 'string' },
      messageCode: { type: 'string' },
      success: { enum: [true], type: 'boolean' },
    },
    required: ['success', 'data'],
    type: 'object',
  };
}

const ref = (model: Model) => ({ $ref: getSchemaPath(model) });

/**
 * What a route answers inside the envelope. `null` for routes answering only a message; a list
 * of models for answers that can take one of several shapes.
 */
export function ApiData(
  model: Model | Model[] | null,
  options: DataOptions = {},
) {
  const models = model === null ? [] : Array.isArray(model) ? model : [model];
  let data: SchemaObject | ReferenceObject;
  if (model === null) data = { nullable: true, type: 'object' };
  else if (models.length > 1) data = { oneOf: models.map(ref) };
  else data = ref(models[0]);
  if (options.array) data = { items: data, type: 'array' };

  return applyDecorators(
    ApiExtraModels(...models),
    ApiResponse({
      description: options.description ?? 'Thành công',
      schema: envelope(data),
      status: options.status ?? 200,
    }),
  );
}

/** A page of a list: `{ items, total, page, pageSize, pageCount }` (see common/pagination.ts). */
export function ApiPage(
  model: Model,
  options: Omit<DataOptions, 'array'> = {},
) {
  return applyDecorators(
    ApiExtraModels(model),
    ApiResponse({
      description: options.description ?? 'Thành công',
      schema: envelope({
        properties: {
          items: { items: ref(model), type: 'array' },
          page: { type: 'integer' },
          pageCount: { type: 'integer' },
          pageSize: { type: 'integer' },
          total: { type: 'integer' },
        },
        required: ['items', 'total', 'page', 'pageSize', 'pageCount'],
        type: 'object',
      }),
      status: options.status ?? 200,
    }),
  );
}
