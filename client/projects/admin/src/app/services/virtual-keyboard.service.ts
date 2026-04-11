import { Injectable, signal } from '@angular/core';

export type KeyboardLayout = 'default' | 'numeric';

@Injectable({ providedIn: 'root' })
export class VirtualKeyboardService {
  /** The currently focused input element, or null when keyboard should be hidden. */
  readonly activeInput = signal<HTMLInputElement | HTMLTextAreaElement | null>(null);

  /** Which layout to show based on input type. */
  readonly layout = signal<KeyboardLayout>('default');

  show(input: HTMLInputElement | HTMLTextAreaElement): void {
    this.activeInput.set(input);
    this.layout.set(this.detectLayout(input));
  }

  hide(): void {
    this.activeInput.set(null);
  }

  private detectLayout(input: HTMLInputElement | HTMLTextAreaElement): KeyboardLayout {
    if (input instanceof HTMLTextAreaElement) return 'default';
    const type = input.type?.toLowerCase();
    const inputMode = input.inputMode?.toLowerCase();
    if (type === 'number' || inputMode === 'numeric' || inputMode === 'decimal') {
      return 'numeric';
    }
    return 'default';
  }
}
