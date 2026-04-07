import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { AuthService } from 'auth';

@Component({
  selector: 'app-pos-shell',
  standalone: true,
  imports: [RouterOutlet, MatToolbarModule, MatButtonModule, MatIconModule],
  template: `
    <mat-toolbar color="primary" class="pos-toolbar">
      <span class="brand">BrewBar</span>
      <span class="spacer"></span>
      <span class="cashier-name">{{ auth.currentUser()?.displayName }}</span>
      <button mat-icon-button (click)="auth.logout()" aria-label="Logout">
        <mat-icon>logout</mat-icon>
      </button>
    </mat-toolbar>
    <div class="pos-content">
      <router-outlet />
    </div>
  `,
  styles: [
    `
      :host {
        display: flex;
        flex-direction: column;
        height: 100vh;
      }
      .pos-toolbar {
        flex-shrink: 0;
        height: 48px;
        font-size: 16px;
      }
      .brand {
        font-weight: 700;
        letter-spacing: 0.5px;
      }
      .spacer {
        flex: 1;
      }
      .cashier-name {
        margin-right: 8px;
        font-size: 14px;
        opacity: 0.9;
      }
      .pos-content {
        flex: 1;
        overflow: hidden;
      }
    `,
  ],
})
export class PosShellComponent {
  protected readonly auth = inject(AuthService);
}
