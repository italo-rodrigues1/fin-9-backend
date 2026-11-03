import type { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface';

export function corsOptions(configuredOrigins?: string): CorsOptions {
  const origins = configuredOrigins?.trim()
    ? configuredOrigins.split(',').map((origin) => origin.trim())
    : [
        'http://localhost:3000',
        'http://localhost:8081',
        'http://localhost:19006',
      ];

  for (const origin of origins) {
    let parsed: URL;
    try {
      parsed = new URL(origin);
    } catch {
      throw new Error(
        'ALLOWED_ORIGINS must contain comma-separated HTTP origins',
      );
    }
    if (
      !['http:', 'https:'].includes(parsed.protocol) ||
      parsed.origin !== origin
    ) {
      throw new Error(
        'ALLOWED_ORIGINS must contain exact HTTP origins without paths',
      );
    }
  }

  return {
    origin: origins,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    // Authentication uses Authorization: Bearer, not cross-origin cookies.
    credentials: false,
  };
}
