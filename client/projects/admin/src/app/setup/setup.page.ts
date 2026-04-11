import { Component, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AuthService } from 'auth';
import { InitialSetupDto } from 'api-client';

/**
 * First-run setup page. Shown only when the API has zero users (detected by
 * an empty /api/auth/staff response). Calls POST /api/auth/setup which is
 * gated server-side by the same zero-users precondition, so this can never
 * be used to overwrite an existing admin.
 *
 * After a successful setup the server returns a JWT for the new admin, so we
 * can navigate straight to /dashboard without a separate login round-trip.
 */
@Component({
  selector: 'app-setup-page',
  standalone: true,
  imports: [
    FormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
  ],
  template: `
    <div class="setup-container">
      <mat-card class="setup-card">
        <mat-card-header>
          <mat-card-title class="brand-title">Welcome to BrewBar</mat-card-title>
          <mat-card-subtitle>Create your administrator account</mat-card-subtitle>
        </mat-card-header>
        <mat-card-content>
          <p class="intro">
            This is a one-time setup. The account you create here is the first administrator and
            cannot be created again from this screen.
          </p>

          <form (ngSubmit)="onSubmit()" class="setup-form" #form="ngForm">
            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Display name</mat-label>
              <input
                matInput
                type="text"
                [(ngModel)]="displayName"
                name="displayName"
                required
                autocomplete="name"
              />
            </mat-form-field>

            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Email</mat-label>
              <input
                matInput
                type="email"
                [(ngModel)]="email"
                name="email"
                required
                email
                autocomplete="email"
              />
            </mat-form-field>

            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Password</mat-label>
              <input
                matInput
                [type]="showPassword() ? 'text' : 'password'"
                [(ngModel)]="password"
                name="password"
                required
                minlength="8"
                autocomplete="new-password"
              />
              <button
                mat-icon-button
                matSuffix
                type="button"
                (click)="showPassword.set(!showPassword())"
              >
                <mat-icon>{{ showPassword() ? 'visibility_off' : 'visibility' }}</mat-icon>
              </button>
              <mat-hint>Min 8 chars, with a lowercase, digit, and symbol</mat-hint>
            </mat-form-field>

            <mat-form-field appearance="outline" class="full-width">
              <mat-label>PIN (4-6 digits)</mat-label>
              <input
                matInput
                [type]="showPin() ? 'text' : 'password'"
                inputmode="numeric"
                pattern="\\d{4,6}"
                [(ngModel)]="pin"
                name="pin"
                required
                minlength="4"
                maxlength="6"
                autocomplete="new-password"
              />
              <button mat-icon-button matSuffix type="button" (click)="showPin.set(!showPin())">
                <mat-icon>{{ showPin() ? 'visibility_off' : 'visibility' }}</mat-icon>
              </button>
              <mat-hint>Used for the POS quick-login screen.</mat-hint>
            </mat-form-field>

            @if (error()) {
              <div class="error-message">{{ error() }}</div>
            }

            <button
              mat-flat-button
              color="primary"
              type="submit"
              class="full-width submit-btn"
              [disabled]="loading() || form.invalid"
            >
              @if (loading()) {
                <mat-spinner diameter="20"></mat-spinner>
              } @else {
                Create admin and continue
              }
            </button>
          </form>
        </mat-card-content>
      </mat-card>
    </div>
  `,
  styles: [
    `
      .setup-container {
        display: flex;
        align-items: center;
        justify-content: center;
        min-height: 100vh;
        padding: 32px 16px;
        background: var(--mat-sys-surface-container-low);
      }
      .setup-card {
        padding: 32px;
        width: 100%;
        max-width: 480px;
      }
      .brand-title {
        font-size: 24px !important;
        font-weight: 700;
      }
      mat-card-header {
        justify-content: center;
        text-align: center;
        margin-bottom: 16px;
      }
      .intro {
        color: var(--mat-sys-on-surface-variant);
        font-size: 14px;
        margin: 0 0 16px;
      }
      .setup-form {
        display: flex;
        flex-direction: column;
        gap: 16px;
      }
      .full-width {
        width: 100%;
      }
      .submit-btn {
        margin-top: 8px;
      }
      .error-message {
        color: var(--mat-sys-error);
        font-size: 14px;
        margin: 8px 0;
      }
    `,
  ],
})
export class SetupPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected displayName = '';
  protected email = '';
  protected password = '';
  protected pin = '';
  protected readonly showPassword = signal(false);
  protected readonly showPin = signal(false);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);

  async onSubmit(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);

    const dto: InitialSetupDto = {
      displayName: this.displayName,
      email: this.email,
      password: this.password,
      pin: this.pin,
    };

    try {
      await this.auth.setup(dto);
      this.router.navigate(['/dashboard']);
    } catch (err) {
      this.error.set(this.errorMessageFor(err));
      this.loading.set(false);
    }
  }

  private errorMessageFor(err: unknown): string {
    if (err instanceof HttpErrorResponse) {
      // 409: setup already completed (someone else created the admin between
      // the page loading and the form being submitted, or the user navigated
      // here directly when they shouldn't have).
      if (err.status === 409) {
        return 'Setup has already been completed. Please sign in instead.';
      }
      // 400: validation error from the server (weak password, bad email, etc.).
      if (err.status === 400 && typeof err.error?.message === 'string') {
        return err.error.message;
      }
      if (err.status === 429) {
        return 'Too many attempts. Please wait a moment and try again.';
      }
    }
    return 'Could not create the admin account. Please check your details and try again.';
  }
}
