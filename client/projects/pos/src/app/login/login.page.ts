import { Component, inject, signal, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AuthService } from 'auth';
import { PinPadComponent } from './pin-pad.component';

@Component({
  selector: 'app-login-page',
  standalone: true,
  imports: [MatCardModule, MatProgressSpinnerModule, PinPadComponent],
  template: `
    <div class="login-container">
      <mat-card class="login-card">
        <mat-card-header>
          <mat-card-title class="brand-title">BrewBar</mat-card-title>
          <mat-card-subtitle>Enter your PIN to sign in</mat-card-subtitle>
        </mat-card-header>
        <mat-card-content>
          @if (loading()) {
            <div class="spinner-wrap">
              <mat-spinner diameter="48"></mat-spinner>
            </div>
          } @else {
            <app-pin-pad
              [error]="error()"
              [loading]="loading()"
              (pinSubmit)="onPinSubmit($event)"
            />
          }
        </mat-card-content>
      </mat-card>
    </div>
  `,
  styles: [
    `
      .login-container {
        display: flex;
        align-items: center;
        justify-content: center;
        height: 100vh;
        background: var(--mat-sys-surface-container-low);
      }
      .login-card {
        padding: 32px;
        min-width: 360px;
        text-align: center;
      }
      .brand-title {
        font-size: 28px !important;
        font-weight: 700;
        letter-spacing: 1px;
      }
      mat-card-header {
        justify-content: center;
        margin-bottom: 24px;
      }
      mat-card-content {
        display: flex;
        justify-content: center;
      }
      .spinner-wrap {
        padding: 40px;
      }
    `,
  ],
})
export class LoginPage {
  @ViewChild(PinPadComponent) private pinPad!: PinPadComponent;

  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);

  async onPinSubmit(pin: string): Promise<void> {
    this.loading.set(true);
    this.error.set(null);

    try {
      await this.auth.pinLogin(pin);
      this.router.navigate(['/register']);
    } catch {
      this.error.set('Invalid PIN. Please try again.');
      this.loading.set(false);
      this.pinPad?.reset();
    }
  }
}
