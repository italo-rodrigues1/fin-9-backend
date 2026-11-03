import {
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { OAuth2Client, TokenPayload } from 'google-auth-library';
import { GoogleIdentityService } from './google-identity.service';

const CLIENT_ID = 'fin9-test.apps.googleusercontent.com';
const validPayload = {
  iss: 'https://accounts.google.com',
  aud: CLIENT_ID,
  sub: 'google-user-123',
  email: 'marina@gmail.com',
  email_verified: true,
  name: 'Marina Souza',
  iat: Math.floor(Date.now() / 1000) - 60,
  exp: Math.floor(Date.now() / 1000) + 3600,
} satisfies TokenPayload;

describe('GoogleIdentityService', () => {
  let service: GoogleIdentityService;
  const verifyIdToken = jest.fn();
  const getConfig = jest.fn();

  beforeEach(() => {
    jest.resetAllMocks();
    getConfig.mockReturnValue(CLIENT_ID);
    verifyIdToken.mockResolvedValue({ getPayload: () => validPayload });
    service = new GoogleIdentityService(
      { get: getConfig } as unknown as ConfigService,
      { verifyIdToken } as unknown as OAuth2Client,
    );
  });

  it('uses the configured Web audience and returns only verified identity data', async () => {
    await expect(service.verify('signed-google-id-token')).resolves.toEqual({
      subject: 'google-user-123',
      email: 'marina@gmail.com',
      name: 'Marina Souza',
      emailAuthoritative: true,
    });
    expect(getConfig).toHaveBeenCalledWith('GOOGLE_WEB_CLIENT_ID');
    expect(verifyIdToken).toHaveBeenCalledWith({
      idToken: 'signed-google-id-token',
      audience: CLIENT_ID,
    });
  });

  it.each([undefined, '', '   '])(
    'fails closed without a configured audience (%s)',
    async (clientId) => {
      getConfig.mockReturnValue(clientId);
      await expect(service.verify('token')).rejects.toBeInstanceOf(
        ServiceUnavailableException,
      );
      expect(verifyIdToken).not.toHaveBeenCalled();
    },
  );

  it.each([
    'invalid signature',
    'wrong recipient, payload audience != requiredAudience',
    'invalid issuer',
    'token used too late, expired',
  ])(
    'does not accept a token rejected by the Google verifier: %s',
    async (reason) => {
      verifyIdToken.mockRejectedValue(new Error(reason));
      await expect(service.verify('untrusted-token')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    },
  );

  it.each([
    undefined,
    { ...validPayload, email_verified: false },
    { ...validPayload, email_verified: 'true' },
    { ...validPayload, email: undefined },
    { ...validPayload, email: 'not-an-email' },
    { ...validPayload, sub: '' },
    { ...validPayload, sub: ' ' },
    { ...validPayload, sub: undefined },
  ])(
    'rejects a verified token with unusable identity claims (%j)',
    async (payload) => {
      verifyIdToken.mockResolvedValue({ getPayload: () => payload });
      await expect(service.verify('token')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    },
  );

  it('normalizes email while preserving the stable Google subject', async () => {
    verifyIdToken.mockResolvedValue({
      getPayload: () => ({ ...validPayload, email: 'MARINA@GMAIL.COM' }),
    });
    await expect(service.verify('token')).resolves.toMatchObject({
      subject: validPayload.sub,
      email: 'marina@gmail.com',
      emailAuthoritative: true,
    });
  });

  it('does not treat a verified third-party address as authoritative', async () => {
    verifyIdToken.mockResolvedValue({
      getPayload: () => ({ ...validPayload, email: 'marina@example.com' }),
    });
    await expect(service.verify('token')).resolves.toMatchObject({
      email: 'marina@example.com',
      emailAuthoritative: false,
    });
  });

  it('treats a verified Workspace account with a hosted domain as authoritative', async () => {
    verifyIdToken.mockResolvedValue({
      getPayload: () => ({
        ...validPayload,
        email: 'marina@empresa.com.br',
        hd: 'empresa.com.br',
      }),
    });
    await expect(service.verify('token')).resolves.toMatchObject({
      emailAuthoritative: true,
    });
  });

  it('uses a bounded name from the email when Google omits a profile name', async () => {
    verifyIdToken.mockResolvedValue({
      getPayload: () => ({ ...validPayload, name: undefined }),
    });
    await expect(service.verify('token')).resolves.toMatchObject({
      name: 'marina',
    });
  });

  it('limits a supplied name to the application profile limit', async () => {
    verifyIdToken.mockResolvedValue({
      getPayload: () => ({ ...validPayload, name: 'A'.repeat(200) }),
    });
    const identity = await service.verify('token');
    expect(identity.name).toHaveLength(100);
  });
});
