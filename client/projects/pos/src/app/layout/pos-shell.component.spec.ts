import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideZonelessChangeDetection } from '@angular/core';
import { AuthService } from 'auth';
import { PrinterService } from 'printing';
import { OutboxService, SyncEngineService } from 'sync';
import { PosShellComponent } from './pos-shell.component';
import { ShiftService } from '../services/shift.service';

function makeAuthStub(roles: string[] | null) {
  const user = roles ? { displayName: 'Test User', roles } : null;
  return {
    currentUser: signal(user),
    canAccessAdminPanel: () => !!roles && (roles.includes('Admin') || roles.includes('Manager')),
    logout: vi.fn(),
  };
}

function configure(authStub: ReturnType<typeof makeAuthStub>) {
  TestBed.configureTestingModule({
    imports: [PosShellComponent],
    providers: [
      provideZonelessChangeDetection(),
      provideRouter([]),
      { provide: AuthService, useValue: authStub },
      {
        provide: PrinterService,
        useValue: { isConnected: false, connect: vi.fn(), disconnect: vi.fn() },
      },
      { provide: OutboxService, useValue: { hasPending: () => false, pendingCount: () => 0 } },
      { provide: SyncEngineService, useValue: { processOutbox: vi.fn() } },
      {
        provide: ShiftService,
        useValue: { currentShift: () => null, closeShift: vi.fn(), addCashDrop: vi.fn() },
      },
    ],
  });
}

describe('PosShellComponent — admin panel button', () => {
  let fixture: ComponentFixture<PosShellComponent>;

  function adminButton(): HTMLAnchorElement | null {
    return fixture.nativeElement.querySelector('a[href="/admin/"]');
  }

  beforeEach(() => {
    TestBed.resetTestingModule();
  });

  it('hides the admin panel button when no user is signed in', () => {
    configure(makeAuthStub(null));
    fixture = TestBed.createComponent(PosShellComponent);
    fixture.detectChanges();

    expect(adminButton()).toBeNull();
  });

  it('hides the admin panel button for a Cashier', () => {
    configure(makeAuthStub(['Cashier']));
    fixture = TestBed.createComponent(PosShellComponent);
    fixture.detectChanges();

    expect(adminButton()).toBeNull();
  });

  it('shows the admin panel button for an Admin and links to /admin/', () => {
    configure(makeAuthStub(['Admin']));
    fixture = TestBed.createComponent(PosShellComponent);
    fixture.detectChanges();

    const btn = adminButton();
    expect(btn).not.toBeNull();
    expect(btn!.getAttribute('href')).toBe('/admin/');
    expect(btn!.getAttribute('aria-label')).toBe('Open admin panel');
  });

  it('shows the admin panel button for a Manager', () => {
    configure(makeAuthStub(['Manager']));
    fixture = TestBed.createComponent(PosShellComponent);
    fixture.detectChanges();

    expect(adminButton()).not.toBeNull();
  });
});
