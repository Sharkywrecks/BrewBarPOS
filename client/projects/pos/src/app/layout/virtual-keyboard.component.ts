import {
  Component,
  inject,
  effect,
  ElementRef,
  viewChild,
  afterNextRender,
  OnDestroy,
} from '@angular/core';
import { VirtualKeyboardService } from '../services/virtual-keyboard.service';
import Keyboard from 'simple-keyboard';

@Component({
  selector: 'app-virtual-keyboard',
  standalone: true,
  template: `
    @if (keyboard.activeInput()) {
      <div class="vk-backdrop" (pointerdown)="onBackdropTap($event)"></div>
      <div
        class="vk-container"
        (mousedown)="$event.preventDefault()"
        (touchstart)="$event.preventDefault()"
      >
        <div class="vk-keyboard" #keyboardEl></div>
      </div>
    }
  `,
  styles: [
    `
      .vk-backdrop {
        position: fixed;
        inset: 0;
        z-index: 999;
      }

      .vk-container {
        position: fixed;
        bottom: 0;
        left: 0;
        right: 0;
        z-index: 1000;
        background: var(--mat-sys-surface-container, #f0f0f0);
        border-top: 1px solid var(--mat-sys-outline-variant, #ccc);
        padding: 8px 8px 12px;
        box-shadow: 0 -4px 16px rgba(0, 0, 0, 0.15);
      }

      :host ::ng-deep .simple-keyboard {
        max-width: 900px;
        margin: 0 auto;
        background: transparent;
        border-radius: 0;
        padding: 0;
      }

      :host ::ng-deep .simple-keyboard .hg-button {
        height: 52px;
        border-radius: 8px;
        background: var(--mat-sys-surface, #fff);
        color: var(--mat-sys-on-surface, #1a1a1a);
        border: none;
        box-shadow: 0 1px 2px rgba(0, 0, 0, 0.12);
        font-size: 18px;
        font-weight: 500;
      }

      :host ::ng-deep .simple-keyboard .hg-button:active {
        background: var(--mat-sys-primary-container, #ddd);
        color: var(--mat-sys-on-primary-container, #000);
      }

      :host ::ng-deep .simple-keyboard .hg-button.hg-activeButton {
        background: var(--mat-sys-primary-container, #ddd);
      }

      :host ::ng-deep .simple-keyboard .hg-row {
        margin-bottom: 4px;
      }

      :host ::ng-deep .simple-keyboard .hg-button[data-skbtn='{bksp}'],
      :host ::ng-deep .simple-keyboard .hg-button[data-skbtn='{enter}'],
      :host ::ng-deep .simple-keyboard .hg-button[data-skbtn='{shift}'],
      :host ::ng-deep .simple-keyboard .hg-button[data-skbtn='{lock}'] {
        background: var(--mat-sys-surface-container-high, #e0e0e0);
      }

      :host ::ng-deep .simple-keyboard .hg-button[data-skbtn='{space}'] {
        min-width: 250px;
      }
    `,
  ],
})
export class VirtualKeyboardComponent implements OnDestroy {
  protected readonly keyboard = inject(VirtualKeyboardService);
  private readonly keyboardEl = viewChild<ElementRef<HTMLElement>>('keyboardEl');
  private keyboardInstance: Keyboard | null = null;

  constructor() {
    afterNextRender(() => {
      // Whenever activeInput changes, rebuild or destroy the keyboard
      effect(() => {
        const input = this.keyboard.activeInput();
        const layout = this.keyboard.layout();
        const el = this.keyboardEl();

        if (input && el) {
          this.buildKeyboard(el.nativeElement, layout, input);
        } else {
          this.destroyKeyboard();
        }
      });
    });
  }

  ngOnDestroy(): void {
    this.destroyKeyboard();
  }

  protected onBackdropTap(event: PointerEvent): void {
    // Only dismiss if tapping outside the keyboard and outside the active input
    const input = this.keyboard.activeInput();
    if (input && !input.contains(event.target as Node)) {
      input.blur();
      this.keyboard.hide();
    }
  }

  private buildKeyboard(
    container: HTMLElement,
    layout: string,
    input: HTMLInputElement | HTMLTextAreaElement,
  ): void {
    this.destroyKeyboard();

    const isNumeric = layout === 'numeric';

    this.keyboardInstance = new Keyboard(container, {
      onChange: (value: string) => this.onKeyboardChange(value, input),
      onKeyPress: (button: string) => this.onKeyPress(button, input),
      layout: isNumeric
        ? {
            default: ['1 2 3', '4 5 6', '7 8 9', '. 0 {bksp}'],
          }
        : {
            default: [
              'q w e r t y u i o p',
              'a s d f g h j k l',
              '{shift} z x c v b n m {bksp}',
              '{numbers} {space} . {enter}',
            ],
            shift: [
              'Q W E R T Y U I O P',
              'A S D F G H J K L',
              '{shift} Z X C V B N M {bksp}',
              '{numbers} {space} . {enter}',
            ],
            numbers: [
              '1 2 3 4 5 6 7 8 9 0',
              '- / : ; ( ) $ & @',
              '{abc} . , ? ! \' " {bksp}',
              '{space} {enter}',
            ],
          },
      display: {
        '{bksp}': '⌫',
        '{enter}': '↵',
        '{shift}': '⇧',
        '{space}': ' ',
        '{numbers}': '123',
        '{abc}': 'ABC',
        '{lock}': '⇪',
      },
      theme: 'hg-theme-default',
      inputName: 'pos-keyboard',
    });

    // Sync the current input value into the keyboard
    this.keyboardInstance.setInput(input.value ?? '');
  }

  private onKeyboardChange(value: string, input: HTMLInputElement | HTMLTextAreaElement): void {
    // For number inputs, we need to use native input setter to trigger Angular
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
      input instanceof HTMLTextAreaElement
        ? HTMLTextAreaElement.prototype
        : HTMLInputElement.prototype,
      'value',
    )?.set;

    nativeInputValueSetter?.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }

  private onKeyPress(button: string, input: HTMLInputElement | HTMLTextAreaElement): void {
    if (button === '{shift}') {
      const currentLayout = this.keyboardInstance?.options.layoutName;
      this.keyboardInstance?.setOptions({
        layoutName: currentLayout === 'shift' ? 'default' : 'shift',
      });
    } else if (button === '{numbers}') {
      this.keyboardInstance?.setOptions({ layoutName: 'numbers' });
    } else if (button === '{abc}') {
      this.keyboardInstance?.setOptions({ layoutName: 'default' });
    } else if (button === '{enter}') {
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      this.keyboard.hide();
      input.blur();
    }
  }

  private destroyKeyboard(): void {
    if (this.keyboardInstance) {
      this.keyboardInstance.destroy();
      this.keyboardInstance = null;
    }
  }
}
