import { Component, output, signal, input } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-pin-pad',
  standalone: true,
  imports: [MatButtonModule, MatIconModule],
  template: `
    <div class="pin-display">
      <span class="pin-dots">
        @for (d of pinDigits(); track $index) {
          <span class="dot filled"></span>
        }
        @for (d of emptyDots(); track $index) {
          <span class="dot"></span>
        }
      </span>
    </div>
    @if (error()) {
      <div class="error-message">{{ error() }}</div>
    }
    <div class="keypad">
      @for (key of keys; track key) {
        <button
          mat-flat-button
          class="key-btn"
          [class.wide]="key === '0'"
          [disabled]="loading()"
          (click)="onKey(key)"
        >
          {{ key }}
        </button>
      }
      <button mat-flat-button class="key-btn" [disabled]="loading()" (click)="onBackspace()">
        <mat-icon>backspace</mat-icon>
      </button>
    </div>
  `,
  styles: [
    `
      :host {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 24px;
      }
      .pin-display {
        height: 48px;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .pin-dots {
        display: flex;
        gap: 12px;
      }
      .dot {
        width: 14px;
        height: 14px;
        border-radius: 50%;
        border: 2px solid var(--mat-sys-primary);
        transition:
          background-color 0.15s,
          transform 0.15s;
      }
      .dot.filled {
        background-color: var(--mat-sys-primary);
        transform: scale(1.15);
      }
      .error-message {
        color: var(--mat-sys-error);
        font-size: 14px;
        min-height: 20px;
      }
      .keypad {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 12px;
        max-width: 300px;
      }
      .key-btn {
        width: 80px;
        height: 64px;
        font-size: 24px;
        font-weight: 500;
        border-radius: 12px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
      }
      .key-btn mat-icon {
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 22px;
        width: 22px;
        height: 22px;
      }
    `,
  ],
})
export class PinPadComponent {
  readonly error = input<string | null>(null);
  readonly loading = input(false);
  readonly maxLength = input(6);
  readonly pinSubmit = output<string>();

  protected readonly pin = signal('');
  protected readonly pinDigits = signal<string[]>([]);
  protected readonly emptyDots = signal<number[]>([]);

  readonly keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'];

  onKey(key: string): void {
    const current = this.pin();
    if (current.length >= this.maxLength()) return;
    const next = current + key;
    this.pin.set(next);
    this.updateDots(next);

    if (next.length >= 4) {
      this.pinSubmit.emit(next);
    }
  }

  onBackspace(): void {
    const current = this.pin();
    if (current.length === 0) return;
    const next = current.slice(0, -1);
    this.pin.set(next);
    this.updateDots(next);
  }

  reset(): void {
    this.pin.set('');
    this.updateDots('');
  }

  private updateDots(pin: string): void {
    this.pinDigits.set(pin.split(''));
    this.emptyDots.set(Array(this.maxLength() - pin.length).fill(0));
  }
}
