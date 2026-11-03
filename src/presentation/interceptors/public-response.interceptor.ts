import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { map } from 'rxjs';

const internalFields = new Set(['userId', 'passwordHash', 'googleSubject']);

/** Defense in depth for raw repository results, including nested relations. */
export function publicResponse(value: unknown): unknown {
  if (value === null || typeof value !== 'object' || value instanceof Date) {
    return value;
  }
  if (Array.isArray(value)) return value.map(publicResponse);
  const jsonValue = value as { toJSON?: () => unknown };
  if (typeof jsonValue.toJSON === 'function') {
    return publicResponse(jsonValue.toJSON());
  }
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !internalFields.has(key))
      .map(([key, item]) => [key, publicResponse(item)]),
  );
}

@Injectable()
export class PublicResponseInterceptor implements NestInterceptor {
  intercept(_context: ExecutionContext, next: CallHandler) {
    return next.handle().pipe(map(publicResponse));
  }
}
