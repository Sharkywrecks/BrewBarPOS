import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { CLIENT_TOKEN, IClient, LoginDto } from 'api-client';
import { firstValueFrom } from 'rxjs';
import { AuthService } from 'auth';

@Component({
  selector: 'app-login-page',
  standalone: true,
  imports: [
    FormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatProgressSpinnerModule,
  ],
  template: `
    <div class="login-container">
      <mat-card class="login-card">
        <mat-card-header>
          <mat-card-title class="brand-title">BrewBar Admin</mat-card-title>
          <mat-card-subtitle>Sign in with your admin account</mat-card-subtitle>
        </mat-card-header>
        <mat-card-content>
          <form (ngSubmit)="onSubmit()" class="login-form">
            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Email</mat-label>
              <input matInput type="email" [(ngModel)]="email" name="email" required />
            </mat-form-field>

            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Password</mat-label>
              <input matInput type="password" [(ngModel)]="password" name="password" required />
            </mat-form-field>

            @if (error()) {
              <div class="error-message">{{ error() }}</div>
            }

            <button
              mat-flat-button
              color="primary"
              type="submit"
              class="full-width"
              [disabled]="loading()"
            >
              @if (loading()) {
                <mat-spinner diameter="20"></mat-spinner>
              } @else {
                Sign In
              }
            </button>
          </form>
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
        min-width: 400px;
        text-align: center;
      }
      .brand-title {
        font-size: 24px !important;
        font-weight: 700;
      }
      mat-card-header {
        justify-content: center;
        margin-bottom: 24px;
      }
      .login-form {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .full-width {
        width: 100%;
      }
      .error-message {
        color: var(--mat-sys-error);
        font-size: 14px;
        margin-bottom: 8px;
      }
    `,
  ],
})
export class LoginPage {
  private readonly client = inject(CLIENT_TOKEN) as IClient;
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected email = '';
  protected password = '';
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);

  async onSubmit(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);

    try {
      const dto: LoginDto = { email: this.email, password: this.password };
      const user = await firstValueFrom(this.client.auth_Login(dto));
      localStorage.setItem('brewbar_token', user.token!);
      this.auth.currentUser.set(user);
      this.router.navigate(['/dashboard']);
    } catch {
      this.error.set('Invalid email or password.');
      this.loading.set(false);
    }
  }
}
