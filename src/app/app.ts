import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AppNavComponent } from './components/layout/app-nav.component';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, AppNavComponent],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {}
