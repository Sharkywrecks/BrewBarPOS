import { Component, inject, HostListener } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { VirtualKeyboardComponent } from './layout/virtual-keyboard.component';
import { VirtualKeyboardService } from './services/virtual-keyboard.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, VirtualKeyboardComponent],
  template: `
    <router-outlet />
    <app-virtual-keyboard />
  `,
  styles: [
    `
      :host {
        display: block;
        height: 100vh;
      }
    `,
  ],
})
export class App {
  private readonly keyboard = inject(VirtualKeyboardService);

  @HostListener('document:focusin', ['$event'])
  onFocusIn(event: FocusEvent): void {
    const target = event.target;
    if (isTextEntryElement(target)) {
      this.keyboard.show(target);
    }
  }

  @HostListener('document:focusout', ['$event'])
  onFocusOut(event: FocusEvent): void {
    const related = event.relatedTarget;
    if (isTextEntryElement(related)) return;
    if (related instanceof HTMLElement && related.closest('.vk-container')) return;
    setTimeout(() => {
      if (!isTextEntryElement(document.activeElement)) {
        this.keyboard.hide();
      }
    }, 50);
  }
}

const TEXT_INPUT_TYPES = new Set([
  'text',
  'password',
  'email',
  'tel',
  'url',
  'search',
  'number',
  '',
]);

function isTextEntryElement(
  target: EventTarget | null,
): target is HTMLInputElement | HTMLTextAreaElement {
  if (target instanceof HTMLTextAreaElement) return true;
  if (target instanceof HTMLInputElement) {
    return TEXT_INPUT_TYPES.has((target.type ?? '').toLowerCase());
  }
  return false;
}
