import { HttpInterceptorFn } from '@angular/common/http';

export const timezoneInterceptor: HttpInterceptorFn = (req, next) => {
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return next(req.clone({ setHeaders: { 'X-Timezone': timezone } }));
};
