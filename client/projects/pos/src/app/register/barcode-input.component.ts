import { Component, output, signal, inject } from '@angular/core';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-barcode-input',
  standalone: true,
  imports: [MatFormFieldModule, MatInputModule, MatIconModule, FormsModule],
  template: `
    <mat-form-field appearance="outline" class="barcode-field">
      <mat-icon matPrefix>qr_code_scanner</mat-icon>
      <input
        matInput
        placeholder="Scan barcode or type SKU..."
        [ngModel]="inputValue()"
        (ngModelChange)="inputValue.set($event)"
        (keydown.enter)="onSubmit()"
      />
    </mat-form-field>
  `,
  styles: [
    `
      .barcode-field {
        width: 100%;
      }
      .barcode-field mat-icon {
        margin-right: 8px;
        opacity: 0.5;
      }
    `,
  ],
})
export class BarcodeInputComponent {
  protected readonly inputValue = signal('');
  readonly barcodeScanned = output<string>();

  protected onSubmit(): void {
    const value = this.inputValue().trim();
    if (value) {
      this.barcodeScanned.emit(value);
      this.inputValue.set('');
    }
  }
}
