import { Component, output, signal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-barcode-input',
  standalone: true,
  imports: [MatIconModule, FormsModule],
  template: `
    <div class="barcode-wrapper">
      <mat-icon class="barcode-icon">search</mat-icon>
      <input
        class="barcode-input"
        placeholder="Search products or scan..."
        [ngModel]="inputValue()"
        (ngModelChange)="onInputChange($event)"
        (keydown.enter)="onSubmit()"
      />
      @if (inputValue()) {
        <button class="clear-btn" (click)="onClear()">
          <mat-icon>close</mat-icon>
        </button>
      }
    </div>
  `,
  styles: [
    `
      .barcode-wrapper {
        display: flex;
        align-items: center;
        gap: 8px;
        height: 38px;
        padding: 0 12px;
        border-radius: 10px;
        border: 1px solid var(--mat-sys-outline-variant);
        background: var(--mat-sys-surface-container);
        transition: border-color 0.15s;
      }
      .barcode-wrapper:focus-within {
        border-color: var(--mat-sys-primary);
      }
      .barcode-icon {
        font-size: 20px;
        width: 20px;
        height: 20px;
        display: flex;
        align-items: center;
        justify-content: center;
        color: var(--mat-sys-on-surface-variant);
        opacity: 0.6;
        flex-shrink: 0;
      }
      .barcode-input {
        border: none;
        outline: none;
        background: transparent;
        font-size: 14px;
        color: var(--mat-sys-on-surface);
        width: 100%;
        height: 100%;
      }
      .barcode-input::placeholder {
        color: var(--mat-sys-on-surface-variant);
        opacity: 0.5;
      }
      .clear-btn {
        display: flex;
        align-items: center;
        justify-content: center;
        border: none;
        background: none;
        cursor: pointer;
        padding: 0;
        color: var(--mat-sys-on-surface-variant);
        opacity: 0.5;
        flex-shrink: 0;
      }
      .clear-btn:hover {
        opacity: 1;
      }
      .clear-btn mat-icon {
        font-size: 18px;
        width: 18px;
        height: 18px;
        display: flex;
        align-items: center;
        justify-content: center;
      }
    `,
  ],
})
export class BarcodeInputComponent {
  protected readonly inputValue = signal('');
  readonly barcodeScanned = output<string>();
  readonly searchChanged = output<string>();

  protected onInputChange(value: string): void {
    this.inputValue.set(value);
    this.searchChanged.emit(value.trim());
  }

  protected onClear(): void {
    this.inputValue.set('');
    this.searchChanged.emit('');
  }

  protected onSubmit(): void {
    const value = this.inputValue().trim();
    if (value) {
      this.barcodeScanned.emit(value);
      this.inputValue.set('');
      this.searchChanged.emit('');
    }
  }
}
