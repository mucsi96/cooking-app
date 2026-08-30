import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class ImageService {
  private readonly http = inject(HttpClient);
  private readonly urlCache = new Map<string, Promise<string>>();

  fetchImageUrl(imageId: string): Promise<string> {
    const cached = this.urlCache.get(imageId);
    if (cached) {
      return cached;
    }

    const url = firstValueFrom(
      this.http.get(`/api/images/${imageId}`, { responseType: 'blob' })
    ).then((blob) => URL.createObjectURL(blob));

    this.urlCache.set(imageId, url);
    return url;
  }
}
