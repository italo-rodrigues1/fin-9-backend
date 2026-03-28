import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Request, Response } from 'express';

interface ApiErrorResponse {
  statusCode: number;
  message: string;
  error: string;
  path: string;
  timestamp: string;
}

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);
  private readonly sensitiveKeys = [
    'password',
    'token',
    'accessToken',
    'refreshToken',
  ];

  private sanitize(value: unknown): unknown {
    if (Array.isArray(value)) {
      return value.map((item) => this.sanitize(item));
    }

    if (value && typeof value === 'object') {
      const sanitized: Record<string, unknown> = {};

      for (const [key, item] of Object.entries(
        value as Record<string, unknown>,
      )) {
        if (this.sensitiveKeys.includes(key)) {
          sanitized[key] = '[REDACTED]';
          continue;
        }

        sanitized[key] = this.sanitize(item);
      }

      return sanitized;
    }

    return value;
  }

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();
    const { method, url, params, query, body: requestBody } = request;

    let statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let error = 'Internal Server Error';

    if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else if (
        typeof exceptionResponse === 'object' &&
        exceptionResponse !== null
      ) {
        const resp = exceptionResponse as Record<string, unknown>;
        message = Array.isArray(resp.message)
          ? resp.message.join(', ')
          : (resp.message as string) || message;
        error = (resp.error as string) || error;
      }
    } else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      if (exception.code === 'P2002') {
        statusCode = HttpStatus.CONFLICT;
        message = 'Resource already exists';
        error = 'Conflict';
      } else if (exception.code === 'P2025') {
        statusCode = HttpStatus.NOT_FOUND;
        message = 'Resource not found';
        error = 'Not Found';
      } else {
        this.logger.error(
          `Unhandled Prisma error: ${exception.code}`,
          exception.message,
        );
      }
    } else if (exception instanceof Error) {
      this.logger.error(exception.message, exception.stack);
    } else {
      this.logger.error(
        'Unknown exception type thrown',
        JSON.stringify(exception),
      );
    }

    const requestContext = JSON.stringify({
      method,
      url,
      params,
      query,
      body: this.sanitize(requestBody),
    });

    if (statusCode >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        `[${method}] ${url} -> ${statusCode} ${error}: ${message}`,
        requestContext,
      );
    } else {
      this.logger.warn(
        `[${method}] ${url} -> ${statusCode} ${error}: ${message}`,
        requestContext,
      );
    }

    const responseBody: ApiErrorResponse = {
      statusCode,
      message,
      error,
      path: request.url,
      timestamp: new Date().toISOString(),
    };

    response.status(statusCode).json(responseBody);
  }
}
