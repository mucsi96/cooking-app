import { Component, effect, inject, signal } from '@angular/core';
import { HttpClient, httpResource } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { RouterLink } from '@angular/router';
import { BarLoaderComponent } from '@mucsi96/angular-material-theme';
import { firstValueFrom } from 'rxjs';

interface Settings {
  readonly extraction: string;
  readonly scene: string;
  readonly images: readonly { readonly id: string; readonly count: number }[];
}
interface Catalog {
  readonly data: readonly { readonly id: string; readonly provider: string }[];
  readonly images: readonly { readonly id: string; readonly name: string }[];
}

@Component({
  selector: 'app-settings',
  imports: [FormsModule, MatButtonModule, MatCardModule, MatFormFieldModule,
    MatInputModule, MatSelectModule, RouterLink, BarLoaderComponent],
  templateUrl: './settings.component.html',
  styles: [`
    :host { display: block; max-width: 900px; margin: 0 auto; padding: 24px 16px; }
    mat-card { margin-block: 20px; }
    mat-card-content { display: flex; flex-direction: column; gap: 12px; padding-top: 20px; }
    .image-row { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
    .image-row span { overflow-wrap: anywhere; }
    .image-row mat-form-field { width: 100px; flex-shrink: 0; }
    .actions { display: flex; align-items: center; gap: 16px; }
  `],
})
export class SettingsComponent {
  private readonly http = inject(HttpClient);
  readonly catalog = httpResource<Catalog>(() => '/api/models');
  readonly settings = httpResource<Settings>(() => '/api/settings/models');
  readonly draft = signal<Settings | undefined>(undefined);
  readonly saving = signal(false);
  readonly message = signal('');

  constructor() {
    effect(() => {
      if (this.settings.hasValue()) this.draft.set(this.settings.value());
    });
  }

  setModel(operation: 'extraction' | 'scene', id: string) {
    this.draft.update(value => value && ({ ...value, [operation]: id }));
    this.message.set('');
  }

  count(id: string) { return this.draft()?.images.find(image => image.id === id)?.count ?? 0; }

  setCount(id: string, count: number) {
    this.draft.update(value => value && ({ ...value,
      images: [...value.images.filter(image => image.id !== id), { id, count }],
    }));
    this.message.set('');
  }

  valid() {
    const value = this.draft();
    return !!value && value.images.every(image => Number.isInteger(image.count) && image.count >= 0 && image.count <= 10)
      && value.images.reduce((sum, image) => sum + image.count, 0) <= 30;
  }

  async save() {
    if (!this.valid() || this.saving()) return;
    this.saving.set(true);
    this.message.set('');
    try {
      await firstValueFrom(this.http.put('/api/settings/models', this.draft()));
      this.message.set('A beállításokat mentettük.');
    } catch {
      this.message.set('A mentés nem sikerült. Próbáld újra.');
    } finally {
      this.saving.set(false);
    }
  }
}
