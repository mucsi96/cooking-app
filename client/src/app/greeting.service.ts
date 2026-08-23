import { HttpClient } from '@angular/common/http';
import { Injectable, inject, resource } from '@angular/core';
import { fetchJson } from './utils/fetchJson';

export interface GreetingResponse {
  name: string;
  message: string;
  aiGreeting: string;
}

@Injectable({
  providedIn: 'root',
})
export class GreetingService {
  private readonly http = inject(HttpClient);

  greeting = resource<GreetingResponse, {}>({
    loader: () =>
      fetchJson<GreetingResponse>(this.http, '/api/greeting'),
  });
}
