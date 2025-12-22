import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  HttpStatus,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map, retry } from 'rxjs/operators';
import { IResponse, IResponseObj } from '../interface/response.interface';
@Injectable()
export class TransformInterceptor<T>
  implements NestInterceptor<T, IResponse<T>>
{
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<IResponse<T>> {
    const skip =
      context.getHandler() &&
      Reflect.getMetadata('skipTransform', context.getHandler());

    if (skip) {
      return next.handle().pipe(
        map((data) => {
          return data;
        }),
      ); // Return response as-is
    }
    return next.handle().pipe(
      map((data) => {
        const returnObject: IResponseObj<T> = {
          statusCode: HttpStatus.OK,
          data: data?.data,
          message: data?.message,
          totalCount: data?.totalCount,
          moduleNames: data?.moduleNames,
          lastSyncTime: data?.lastSyncTime,
          pagination: data?.pagination,
          step: data?.step,
        };
        return returnObject;
      }),
    );
  }
}
