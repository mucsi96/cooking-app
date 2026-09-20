import {
  Component,
  effect,
  input,
  signal,
} from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { httpResource } from '@angular/common/http';

@Component({
  selector: 'app-recipe-image',
  imports: [MatIconModule],
  templateUrl: './recipe-image.component.html',
  styleUrl: './recipe-image.component.css',
})
export class RecipeImageComponent {
  readonly imageId = input.required<string | null>();
  readonly alt = input<string>('');

  readonly url = signal<string | null>(null);
  private readonly image = httpResource.blob(() => {
    const id = this.imageId();
    return id ? `/api/images/${id}` : undefined;
  });

  constructor() {
    effect((onCleanup) => {
      const blob = this.image.hasValue() ? this.image.value() : undefined;
      const url = blob ? URL.createObjectURL(blob) : null;
      this.url.set(url);
      if (url) onCleanup(() => URL.revokeObjectURL(url));
    });
  }
}
