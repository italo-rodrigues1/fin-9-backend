import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/** Explicit opt-out from the global JWT guard for authentication and liveness. */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
