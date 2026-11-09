import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { NotificationsService } from '@mucsi96/angular-material-theme';
import { catchError } from 'rxjs';

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const notifications = inject(NotificationsService);
  return next(req).pipe(
    catchError((error) => {
      if (!(error instanceof HttpErrorResponse && error.status === 401)) notifications.error('An error occurred. ' + error.message);
      return Promise.reject(error);
    })
  );
};
