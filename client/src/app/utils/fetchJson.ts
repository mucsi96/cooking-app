import { HttpClient, HttpHeaders } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

export async function fetchJson<T>(
  http: HttpClient,
  url: string,
  options: { body?: unknown; method?: string; headers?: Record<string, string> } = {}
) {
  const { body, method = 'get', headers: extraHeaders = {} } = options;
  const headers = new HttpHeaders({ Accept: 'application/json', ...extraHeaders });
  const requestHeaders = body instanceof FormData
    ? headers
    : headers.set('Content-Type', 'application/json');
  const response = await firstValueFrom(
    http.request(method, url, {
      headers: requestHeaders,
      body,
      responseType: 'json',
    })
  );
  return response as T;
}
