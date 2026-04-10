import { Component, inject, HostListener } from '@angular/core';
import { RouterOutlet, Router } from '@angular/router';
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
  private readonly router = inject(Router);

  @HostListener('focusin', ['$event'])
  onFocusIn(event: FocusEvent): void {
    const target = event.target;
    if (
      (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) &&
      !this.isLoginRoute()
    ) {
      this.keyboard.show(target);
    }
  }

  @HostListener('focusout', ['$event'])
  onFocusOut(event: FocusEvent): void {
    const related = event.relatedTarget;
    // If focus moved to another input, the focusin handler will take over
    if (related instanceof HTMLInputElement || related instanceof HTMLTextAreaElement) return;
    // If focus moved to the keyboard container, keep keyboard open
    if (related instanceof HTMLElement && related.closest('.vk-container')) return;
    // Delay slightly so preventDefault on keyboard mousedown/touchstart can keep focus
    setTimeout(() => {
      const active = document.activeElement;
      if (!(active instanceof HTMLInputElement) && !(active instanceof HTMLTextAreaElement)) {
        this.keyboard.hide();
      }
    }, 50);
  }

  private isLoginRoute(): boolean {
    return this.router.url.startsWith('/login');
  }
}
