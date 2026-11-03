import {
  createParamDecorator,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';

export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<{
      user?: { id: string; email: string };
    }>();
    if (!request.user) throw new UnauthorizedException();
    return request.user;
  },
);
