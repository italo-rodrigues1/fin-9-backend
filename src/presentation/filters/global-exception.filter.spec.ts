import { ArgumentsHost, Logger, UnauthorizedException } from '@nestjs/common';
import { GlobalExceptionFilter } from './global-exception.filter';

describe('GlobalExceptionFilter — authentication credential redaction', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('redacts Google credentials and other secrets recursively before logging a rejected login', () => {
    const warn = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => {});
    const json = jest.fn();
    const response = { status: jest.fn().mockReturnValue({ json }) };
    const body = {
      idToken: 'sensitive-google-id-token',
      credential: 'sensitive-gis-credential',
      email: 'test@example.com',
      nested: [
        {
          password: 'sensitive-password',
          token: 'sensitive-app-token',
          accessToken: 'sensitive-access-token',
          refreshToken: 'sensitive-refresh-token',
          idToken: 'sensitive-nested-google-token',
          credential: 'sensitive-nested-gis-credential',
          context: 'retained context',
        },
      ],
    };
    const host = {
      switchToHttp: () => ({
        getRequest: () => ({ method: 'POST', url: '/auth/google', body }),
        getResponse: () => response,
      }),
    } as unknown as ArgumentsHost;

    new GlobalExceptionFilter().catch(
      new UnauthorizedException('Google inválido'),
      host,
    );

    expect(response.status).toHaveBeenCalledWith(401);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 401,
        message: 'Google inválido',
        path: '/auth/google',
      }),
    );
    expect(warn).toHaveBeenCalledTimes(1);
    const context = JSON.parse(warn.mock.calls[0][1] as string) as {
      body: unknown;
    };
    expect(context.body).toEqual({
      idToken: '[REDACTED]',
      credential: '[REDACTED]',
      email: 'test@example.com',
      nested: [
        {
          password: '[REDACTED]',
          token: '[REDACTED]',
          accessToken: '[REDACTED]',
          refreshToken: '[REDACTED]',
          idToken: '[REDACTED]',
          credential: '[REDACTED]',
          context: 'retained context',
        },
      ],
    });
    expect(JSON.stringify(warn.mock.calls)).not.toContain('sensitive-');
    expect(body.idToken).toBe('sensitive-google-id-token');
  });
});
