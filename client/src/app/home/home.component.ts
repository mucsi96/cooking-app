import { Component, inject } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { BarLoaderComponent } from '@mucsi96/angular-material-theme';
import { GreetingService } from '../greeting.service';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [
    BarLoaderComponent,
    MatCardModule,
  ],
  templateUrl: './home.component.html',
  styleUrl: './home.component.css',
})
export class HomeComponent {
  private readonly greetingService = inject(GreetingService);
  readonly greeting = this.greetingService.greeting;
}
