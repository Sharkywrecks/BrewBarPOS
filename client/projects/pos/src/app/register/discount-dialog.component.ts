import { Component, inject, signal, computed } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { FormsModule } from '@angular/forms';
import { AppCurrencyPipe } from '../services/app-currency.pipe';
import { DiscountType } from 'api-client';

export interface DiscountDialogData {
  itemLabel: string;
  grossAmount: number;
}

export interface DiscountDialogResult {
  type: DiscountType;
  value: number;
  reason: string;
}

@Component({
  selector: 'app-discount-dialog',
  standalone: true,
  imports: [
    MatDialogModule,
    MatButtonModule,
    MatButtonToggleModule,
    MatFormFieldModule,
    MatInputModule,
    FormsModule,
    AppCurrencyPipe,
  ],
  template: `
    <h2 mat-dialog-title>Discount — {{ data.itemLabel }}</h2>
    <mat-dialog-content>
      <mat-button-toggle-group [(ngModel)]="discountType" class="type-toggle">
        <mat-button-toggle [value]="DiscountType.Percentage">%</mat-button-toggle>
        <mat-button-toggle [value]="DiscountType.FixedAmount">Fixed</mat-button-toggle>
      </mat-button-toggle-group>

      <mat-form-field appearance="outline" class="value-field">
        <mat-label>{{
          discountType() === DiscountType.Percentage ? 'Percent off' : 'Amount off'
        }}</mat-label>
        <input matInput type="number" min="0" [(ngModel)]="discountValue" />
        @if (discountType() === DiscountType.Percentage) {
          <span matTextSuffix>%</span>
        }
      </mat-form-field>

      <div class="preview">Discount: {{ computedAmount() | appCurrency }}</div>

      <mat-form-field appearance="outline" class="reason-field">
        <mat-label>Reason (required)</mat-label>
        <input matInput [(ngModel)]="reason" />
      </mat-form-field>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Cancel</button>
      <button mat-flat-button color="primary" [disabled]="!canApply()" (click)="onApply()">
        Apply Discount
      </button>
    </mat-dialog-actions>
  `,
  styles: [
    `
      .type-toggle {
        width: 100%;
        margin-bottom: 16px;
      }
      .value-field,
      .reason-field {
        width: 100%;
      }
      .preview {
        font-size: 16px;
        font-weight: 600;
        padding: 8px 0 16px;
      }
    `,
  ],
})
export class DiscountDialogComponent {
  protected readonly data = inject<DiscountDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(MatDialogRef<DiscountDialogComponent>);

  protected readonly DiscountType = DiscountType;
  protected readonly discountType = signal<DiscountType>(DiscountType.Percentage);
  protected readonly discountValue = signal(0);
  protected readonly reason = signal('');

  protected readonly computedAmount = computed(() => {
    const val = this.discountValue();
    if (this.discountType() === DiscountType.Percentage) {
      return Math.round(this.data.grossAmount * (val / 100) * 100) / 100;
    }
    return val;
  });

  protected readonly canApply = computed(() => {
    return (
      this.discountValue() > 0 &&
      this.reason().trim().length > 0 &&
      this.computedAmount() <= this.data.grossAmount
    );
  });

  protected onApply(): void {
    const result: DiscountDialogResult = {
      type: this.discountType(),
      value: this.discountValue(),
      reason: this.reason().trim(),
    };
    this.dialogRef.close(result);
  }
}
