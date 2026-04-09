import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideRouter, Router } from '@angular/router';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { HttpErrorResponse } from '@angular/common/http';
import { AuthService } from 'auth';
import { SetupPage } from './setup.page';

function makeAuthMock() {
  return {
    setup: vi.fn(),
  };
}

describe('SetupPage', () => {
  let component: SetupPage;
  let fixture: ComponentFixture<SetupPage>;
  let auth: ReturnType<typeof makeAuthMock>;
  let router: { navigate: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    auth = makeAuthMock();
    router = { navigate: vi.fn().mockResolvedValue(true) };

    await TestBed.configureTestingModule({
      imports: [SetupPage],
      providers: [
        provideZonelessChangeDetection(),
        provideNoopAnimations(),
        provideRouter([]),
        { provide: AuthService, useValue: auth },
        { provide: Router, useValue: router },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(SetupPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('passes form values to AuthService.setup and navigates to /dashboard on success', async () => {
    auth.setup.mockResolvedValue({ id: 'u1', email: 'owner@cafe', token: 'jwt' });
    component['displayName'] = 'Cafe Owner';
    component['email'] = 'owner@cafe.local';
    component['password'] = 'OwnerPass123!';
    component['pin'] = '4242';

    await component.onSubmit();

    expect(auth.setup).toHaveBeenCalledWith({
      displayName: 'Cafe Owner',
      email: 'owner@cafe.local',
      password: 'OwnerPass123!',
      pin: '4242',
    });
    expect(router.navigate).toHaveBeenCalledWith(['/dashboard']);
    expect(component['error']()).toBeNull();
  });

  it('shows a friendly message on 409 (setup already completed)', async () => {
    auth.setup.mockRejectedValue(
      new HttpErrorResponse({ status: 409, statusText: 'Conflict', error: { message: 'nope' } }),
    );

    await component.onSubmit();

    expect(component['error']()).toMatch(/already been completed/i);
    expect(router.navigate).not.toHaveBeenCalled();
    expect(component['loading']()).toBe(false);
  });

  it('shows server-supplied message on 400 (validation)', async () => {
    auth.setup.mockRejectedValue(
      new HttpErrorResponse({
        status: 400,
        statusText: 'Bad Request',
        error: { message: 'Password too weak' },
      }),
    );

    await component.onSubmit();

    expect(component['error']()).toBe('Password too weak');
  });

  it('shows a rate-limit message on 429', async () => {
    auth.setup.mockRejectedValue(
      new HttpErrorResponse({ status: 429, statusText: 'Too Many Requests' }),
    );

    await component.onSubmit();

    expect(component['error']()).toMatch(/too many attempts/i);
  });

  it('shows a generic message on unexpected errors', async () => {
    auth.setup.mockRejectedValue(new Error('boom'));

    await component.onSubmit();

    expect(component['error']()).toMatch(/check your details/i);
  });
});
