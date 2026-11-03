import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { withDatabaseUser } from './database-context';

@Injectable()
export class DatabaseContextInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context
      .switchToHttp()
      .getRequest<{ user?: { id: string } }>();
    if (!request.user) return next.handle();
    return new Observable((subscriber) =>
      withDatabaseUser(request.user!.id, () =>
        next.handle().subscribe(subscriber),
      ),
    );
  }
}
