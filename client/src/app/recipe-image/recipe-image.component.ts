import {
  Component,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { ImageService } from '../image.service';

@Component({
  selector: 'app-recipe-image',
  imports: [MatIconModule],
  templateUrl: './recipe-image.component.html',
  styleUrl: './recipe-image.component.css',
})
export class RecipeImageComponent {
  private readonly imageService = inject(ImageService);

  readonly imageId = input.required<string | null>();
  readonly alt = input<string>('');

  readonly url = signal<string | null>(null);

  constructor() {
    effect(() => {
      const imageId = this.imageId();
      this.url.set(null);
      if (imageId) {
        this.imageService
          .fetchImageUrl(imageId)
          .then((url) => this.url.set(url))
          .catch(() => this.url.set(null));
      }
    });
  }
}
