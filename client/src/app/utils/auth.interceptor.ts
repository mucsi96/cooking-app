import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { tap } from 'rxjs';
import { AuthService } from '../auth.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const url = new URL(req.url, window.location.origin);
  const isApi = url.origin === window.location.origin && (url.pathname === '/api' || url.pathname.startsWith('/api/'));
  return next(req).pipe(tap({ error: (error: unknown) => {
    if (isApi && error instanceof HttpErrorResponse && error.status === 401) auth.requireLogin();
  } }));
};
