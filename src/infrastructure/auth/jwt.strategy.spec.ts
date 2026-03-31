import { ConfigService } from '@nestjs/config';

import { JwtStrategy } from './jwt.strategy';

function makeConfigService(jwtSecret: string | undefined): ConfigService {
  return {
    get: (key: string) => (key === 'JWT_SECRET' ? jwtSecret : undefined),
  } as unknown as ConfigService;
}

describe('JwtStrategy', () => {
  it('throws when JWT_SECRET is undefined', () => {
    expect(() => new JwtStrategy(makeConfigService(undefined))).toThrow(
      'JWT_SECRET must be defined and at least 32 characters long',
    );
  });

  it('throws when JWT_SECRET has less than 32 characters', () => {
    expect(() => new JwtStrategy(makeConfigService('short_secret'))).toThrow(
      'JWT_SECRET must be defined and at least 32 characters long',
    );
  });

  it('throws when JWT_SECRET has exactly 31 characters', () => {
    const secret = 'a'.repeat(31);
    expect(() => new JwtStrategy(makeConfigService(secret))).toThrow(
      'JWT_SECRET must be defined and at least 32 characters long',
    );
  });

  it('initializes normally when JWT_SECRET has exactly 32 characters', () => {
    const secret = 'a'.repeat(32);
    expect(() => new JwtStrategy(makeConfigService(secret))).not.toThrow();
  });

  it('initializes normally when JWT_SECRET has more than 32 characters', () => {
    const secret = 'a'.repeat(64);
    expect(() => new JwtStrategy(makeConfigService(secret))).not.toThrow();
  });
});
