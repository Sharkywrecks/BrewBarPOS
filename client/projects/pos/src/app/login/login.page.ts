import { Component, inject, signal, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AuthService } from 'auth';
import { StaffDto } from 'api-client';
import { PinPadComponent } from './pin-pad.component';

@Component({
  selector: 'app-login-page',
  standalone: true,
  imports: [
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    PinPadComponent,
  ],
  template: `
    <div class="login-container">
      <mat-card class="login-card">
        <mat-card-header>
          <mat-card-title class="brand-title">BrewBar</mat-card-title>
          <mat-card-subtitle>
            @if (selectedUser()) {
              Enter PIN for {{ selectedUser()!.displayName }}
            } @else {
              Select your name to sign in
            }
          </mat-card-subtitle>
        </mat-card-header>
        <mat-card-content>
          @if (loadingStaff()) {
            <div class="spinner-wrap">
              <mat-spinner diameter="48"></mat-spinner>
            </div>
          } @else if (!selectedUser()) {
            <div class="staff-grid">
              @for (member of staff(); track member.id) {
                <button mat-flat-button class="staff-btn" (click)="selectUser(member)">
                  <mat-icon class="staff-icon">person</mat-icon>
                  <span>{{ member.displayName }}</span>
                </button>
              }
              @if (staff().length === 0) {
                <p class="no-staff">No staff members found.</p>
              }
            </div>
          } @else if (loading()) {
            <div class="spinner-wrap">
              <mat-spinner diameter="48"></mat-spinner>
            </div>
          } @else {
            <div class="pin-section">
              <app-pin-pad
                [error]="error()"
                [loading]="loading()"
                (pinSubmit)="onPinSubmit($event)"
              />
              <button mat-button class="back-btn" (click)="clearSelection()">
                <mat-icon>arrow_back</mat-icon>
                Different user
              </button>
            </div>
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
        padding: 36px 32px;
        min-width: 360px;
        max-width: 480px;
        text-align: center;
        border-radius: 16px;
      }
      .brand-title {
        font-size: 32px !important;
        font-weight: 800;
        letter-spacing: 1.5px;
        color: var(--mat-sys-primary);
      }
      mat-card-header {
        justify-content: center;
        margin-bottom: 28px;
      }
      mat-card-content {
        display: flex;
        justify-content: center;
      }
      .spinner-wrap {
        padding: 40px;
      }
      .staff-grid {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 12px;
        width: 100%;
      }
      .staff-btn {
        display: inline-flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 6px;
        padding: 20px 16px;
        height: auto;
        min-height: 88px;
        font-size: 15px;
        border-radius: 12px;
        line-height: 1.3;
      }
      .staff-icon {
        font-size: 28px;
        width: 28px;
        height: 28px;
        display: flex;
        align-items: center;
        justify-content: center;
        opacity: 0.8;
      }
      .no-staff {
        grid-column: 1 / -1;
        color: var(--mat-sys-on-surface-variant);
        padding: 24px;
      }
      .pin-section {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 16px;
      }
      .back-btn {
        margin-top: 8px;
      }
    `,
  ],
})
export class LoginPage {
  @ViewChild(PinPadComponent) private pinPad!: PinPadComponent;

  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly staff = signal<StaffDto[]>([]);
  protected readonly selectedUser = signal<StaffDto | null>(null);
  protected readonly loadingStaff = signal(true);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);

  constructor() {
    this.loadStaff();
  }

  private async loadStaff(): Promise<void> {
    try {
      const members = await this.auth.getStaff();
      this.staff.set(members);
    } catch {
      this.staff.set([]);
    } finally {
      this.loadingStaff.set(false);
    }
  }

  selectUser(member: StaffDto): void {
    this.selectedUser.set(member);
    this.error.set(null);
  }

  clearSelection(): void {
    this.selectedUser.set(null);
    this.error.set(null);
  }

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
