import { Component, inject, signal, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import {
  CLIENT_TOKEN,
  IClient,
  BusinessSettingsDto,
  UpdateBusinessSettingsDto,
  Currency,
} from 'api-client';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [
    FormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
  ],
  template: `
    <h1>Settings</h1>

    @if (loading()) {
      <mat-spinner diameter="32" class="spinner"></mat-spinner>
    } @else if (settings()) {
      <mat-card class="settings-card">
        <mat-card-content>
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Store Name</mat-label>
            <input matInput [(ngModel)]="storeName" />
          </mat-form-field>

          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Store Info</mat-label>
            <textarea matInput [(ngModel)]="storeInfo" rows="3"></textarea>
          </mat-form-field>

          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Tax Rate (%)</mat-label>
            <input
              matInput
              type="number"
              [(ngModel)]="taxRatePercent"
              min="0"
              max="100"
              step="0.1"
            />
          </mat-form-field>

          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Currency</mat-label>
            <mat-select [(ngModel)]="currency">
              @for (opt of currencyOptions; track opt.value) {
                <mat-option [value]="opt.value">{{ opt.label }}</mat-option>
              }
            </mat-select>
          </mat-form-field>

          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Discount Approval Threshold</mat-label>
            <input
              matInput
              type="number"
              [(ngModel)]="discountApprovalThreshold"
              min="0"
              step="0.01"
            />
          </mat-form-field>
        </mat-card-content>
        <mat-card-actions align="end">
          <button mat-flat-button color="primary" [disabled]="saving()" (click)="onSave()">
            @if (saving()) {
              <mat-spinner diameter="20"></mat-spinner>
            } @else {
              <mat-icon>save</mat-icon> Save
            }
          </button>
        </mat-card-actions>
      </mat-card>
    }
  `,
  styles: [
    `
      .settings-card {
        max-width: 600px;
        padding: 24px;
      }
      .full-width {
        width: 100%;
      }
      .spinner {
        margin: 48px auto;
      }
    `,
  ],
})
export class SettingsPage implements OnInit {
  private readonly client = inject(CLIENT_TOKEN) as IClient;
  private readonly snackBar = inject(MatSnackBar);

  readonly settings = signal<BusinessSettingsDto | null>(null);
  readonly loading = signal(false);
  readonly saving = signal(false);

  storeName = '';
  storeInfo = '';
  taxRatePercent = 0;
  currency: Currency = Currency.SCR;
  discountApprovalThreshold = 0;

  readonly currencyOptions = [
    { value: Currency.SCR, label: 'SCR (Seychelles Rupee)' },
    { value: Currency.USD, label: 'USD (US Dollar)' },
    { value: Currency.EUR, label: 'EUR (Euro)' },
    { value: Currency.GBP, label: 'GBP (British Pound)' },
    { value: Currency.AED, label: 'AED (UAE Dirham)' },
  ];

  async ngOnInit() {
    this.loading.set(true);
    try {
      const s = await firstValueFrom(this.client.settings_GetSettings());
      this.settings.set(s);
      this.storeName = s.storeName ?? '';
      this.storeInfo = s.storeInfo ?? '';
      this.taxRatePercent = (s.taxRate ?? 0) * 100;
      this.currency = s.currency ?? Currency.SCR;
      this.discountApprovalThreshold = s.discountApprovalThreshold ?? 0;
    } finally {
      this.loading.set(false);
    }
  }

  async onSave() {
    this.saving.set(true);
    try {
      const dto: UpdateBusinessSettingsDto = {
        storeName: this.storeName,
        storeInfo: this.storeInfo || null,
        taxRate: this.taxRatePercent / 100,
        currency: this.currency,
        discountApprovalThreshold: this.discountApprovalThreshold,
      };
      const updated = await firstValueFrom(this.client.settings_UpdateSettings(dto));
      this.settings.set(updated);
      this.snackBar.open('Settings saved.', 'OK', { duration: 3000 });
    } catch {
      this.snackBar.open('Failed to save settings.', 'Dismiss', {
        duration: 5000,
      });
    } finally {
      this.saving.set(false);
    }
  }
}
