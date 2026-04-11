import {
  Component,
  inject,
  effect,
  ElementRef,
  viewChild,
  afterNextRender,
  OnDestroy,
} from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { VirtualKeyboardService } from '../services/virtual-keyboard.service';
import Keyboard from 'simple-keyboard';

@Component({
  selector: 'app-virtual-keyboard',
  standalone: true,
  template: `
    <div
      #popoverEl
      popover="manual"
      class="vk-popover"
      (mousedown)="$event.preventDefault()"
      (touchstart)="$event.preventDefault()"
    >
      <div class="vk-backdrop" (pointerdown)="onBackdropTap($event)"></div>
      <div class="vk-container">
        <button class="vk-close" (click)="onClose()" aria-label="Close keyboard">
          <span class="vk-close-icon">&#x2715;</span>
        </button>
        <div class="vk-keyboard" #keyboardEl></div>
      </div>
    </div>
  `,
})
export class VirtualKeyboardComponent implements OnDestroy {
  protected readonly keyboard = inject(VirtualKeyboardService);
  private readonly keyboardEl = viewChild<ElementRef<HTMLElement>>('keyboardEl');
  private readonly popoverEl = viewChild<ElementRef<HTMLElement>>('popoverEl');
  private readonly el = inject(ElementRef);
  private readonly doc = inject(DOCUMENT);
  private keyboardInstance: Keyboard | null = null;

  private rendered = false;

  constructor() {
    afterNextRender(() => {
      this.rendered = true;
      this.doc.body.appendChild(this.el.nativeElement);
    });

    effect(() => {
      const input = this.keyboard.activeInput();
      const layout = this.keyboard.layout();
      const el = this.keyboardEl();
      const popover = this.popoverEl()?.nativeElement;

      if (!this.rendered) return;

      if (input && el && popover) {
        try {
          popover.showPopover();
        } catch {}
        this.buildKeyboard(el.nativeElement, layout, input);
      } else {
        this.destroyKeyboard();
        try {
          popover?.hidePopover();
        } catch {}
      }
    });
  }

  ngOnDestroy(): void {
    this.destroyKeyboard();
    try {
      this.popoverEl()?.nativeElement.hidePopover();
    } catch {}
    this.el.nativeElement.remove();
  }

  protected onClose(): void {
    const input = this.keyboard.activeInput();
    input?.blur();
    this.keyboard.hide();
  }

  protected onBackdropTap(event: PointerEvent): void {
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
              '. , ? ! \' " {bksp}',
              '{abc} {space} . {enter}',
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

    this.keyboardInstance.setInput(input.value ?? '');
  }

  private onKeyboardChange(value: string, input: HTMLInputElement | HTMLTextAreaElement): void {
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
