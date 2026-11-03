import {
  Inject,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { isEmail } from 'class-validator';
import { OAuth2Client } from 'google-auth-library';
import type { GoogleIdentity } from '../../domain/repositories/user.repository';

export const GOOGLE_TOKEN_CLIENT = Symbol('GOOGLE_TOKEN_CLIENT');

@Injectable()
export class GoogleIdentityService {
  constructor(
    private readonly config: ConfigService,
    @Inject(GOOGLE_TOKEN_CLIENT) private readonly client: OAuth2Client,
  ) {}

  async verify(idToken: string): Promise<GoogleIdentity> {
    const audience = this.config.get<string>('GOOGLE_WEB_CLIENT_ID')?.trim();
    if (!audience) {
      throw new ServiceUnavailableException(
        'O acesso com Google ainda não está configurado.',
      );
    }

    try {
      // The official client verifies the signature, issuer, audience and expiry
      // against Google's rotating public keys. Client-provided profile data is
      // never trusted for account creation or linking.
      const ticket = await this.client.verifyIdToken({ idToken, audience });
      const payload = ticket.getPayload();
      if (
        !payload ||
        payload.email_verified !== true ||
        typeof payload.sub !== 'string' ||
        !payload.sub.trim() ||
        payload.sub.length > 255 ||
        typeof payload.email !== 'string' ||
        payload.email.length > 254 ||
        !isEmail(payload.email)
      ) {
        throw new UnauthorizedException();
      }

      const email = payload.email.trim().toLowerCase();
      const name = (
        typeof payload.name === 'string' && payload.name.trim()
          ? payload.name.trim()
          : email.split('@')[0]
      ).slice(0, 100);
      return {
        subject: payload.sub,
        email,
        name,
        emailAuthoritative:
          email.endsWith('@gmail.com') ||
          (typeof payload.hd === 'string' && payload.hd.trim().length > 0),
      };
    } catch {
      throw new UnauthorizedException(
        'Não foi possível validar sua conta Google. Tente entrar novamente.',
      );
    }
  }
}
