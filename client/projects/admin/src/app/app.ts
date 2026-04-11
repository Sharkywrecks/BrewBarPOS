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
    if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
      this.keyboard.show(target);
    }
  }

  @HostListener('document:focusout', ['$event'])
  onFocusOut(event: FocusEvent): void {
    const related = event.relatedTarget;
    if (related instanceof HTMLInputElement || related instanceof HTMLTextAreaElement) return;
    if (related instanceof HTMLElement && related.closest('.vk-container')) return;
    setTimeout(() => {
      const active = document.activeElement;
      if (!(active instanceof HTMLInputElement) && !(active instanceof HTMLTextAreaElement)) {
        this.keyboard.hide();
      }
    }, 50);
  }
}
