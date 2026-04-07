import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { AuthService } from './auth.service';
import { CLIENT_TOKEN, IClient, UserDto } from 'api-client';

function makeMockClient(): Partial<IClient> {
  return {
    auth_PinLogin: vi.fn(),
    auth_GetCurrentUser: vi.fn(),
  };
}

function makeUser(overrides: Partial<UserDto> = {}): UserDto {
  return {
    email: 'cashier@brewbar.com',
    displayName: 'Demo Cashier',
    token: 'jwt-token-123',
    ...overrides,
  } as UserDto;
}

describe('AuthService', () => {
  let service: AuthService;
  let client: ReturnType<typeof makeMockClient>;
  let router: { navigate: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    client = makeMockClient();
    router = { navigate: vi.fn() };
    localStorage.clear();

    TestBed.configureTestingModule({
      providers: [
        AuthService,
        { provide: CLIENT_TOKEN, useValue: client },
        { provide: Router, useValue: router },
      ],
    });
    service = TestBed.inject(AuthService);
  });

  it('should start unauthenticated', () => {
    expect(service.isAuthenticated()).toBe(false);
    expect(service.currentUser()).toBeNull();
  });

  describe('pinLogin', () => {
    it('should set current user on successful login', async () => {
      const user = makeUser();
      (client.auth_PinLogin as ReturnType<typeof vi.fn>).mockReturnValue(of(user));

      const result = await service.pinLogin('1234');

      expect(result).toEqual(user);
      expect(service.currentUser()).toEqual(user);
      expect(service.isAuthenticated()).toBe(true);
    });

    it('should store token in localStorage', async () => {
      const user = makeUser({ token: 'my-jwt' });
      (client.auth_PinLogin as ReturnType<typeof vi.fn>).mockReturnValue(of(user));

      await service.pinLogin('1234');

      expect(localStorage.getItem('brewbar_token')).toBe('my-jwt');
    });

    it('should call API with correct pin', async () => {
      (client.auth_PinLogin as ReturnType<typeof vi.fn>).mockReturnValue(of(makeUser()));

      await service.pinLogin('9999');

      expect(client.auth_PinLogin).toHaveBeenCalledWith({ pin: '9999' });
    });
  });

  describe('loadStoredUser', () => {
    it('should load user when token exists', async () => {
      localStorage.setItem('brewbar_token', 'stored-jwt');
      const user = makeUser();
      (client.auth_GetCurrentUser as ReturnType<typeof vi.fn>).mockReturnValue(of(user));

      await service.loadStoredUser();

      expect(service.currentUser()).toEqual(user);
      expect(service.isAuthenticated()).toBe(true);
    });

    it('should do nothing when no token stored', async () => {
      await service.loadStoredUser();

      expect(client.auth_GetCurrentUser).not.toHaveBeenCalled();
      expect(service.isAuthenticated()).toBe(false);
    });

    it('should clear token on API error', async () => {
      localStorage.setItem('brewbar_token', 'expired-jwt');
      (client.auth_GetCurrentUser as ReturnType<typeof vi.fn>).mockReturnValue(
        throwError(() => new Error('Unauthorized')),
      );

      await service.loadStoredUser();

      expect(localStorage.getItem('brewbar_token')).toBeNull();
      expect(service.isAuthenticated()).toBe(false);
    });
  });

  describe('logout', () => {
    it('should clear user and token', async () => {
      // First log in
      (client.auth_PinLogin as ReturnType<typeof vi.fn>).mockReturnValue(of(makeUser()));
      await service.pinLogin('1234');

      service.logout();

      expect(service.currentUser()).toBeNull();
      expect(service.isAuthenticated()).toBe(false);
      expect(localStorage.getItem('brewbar_token')).toBeNull();
    });

    it('should navigate to login page', () => {
      service.logout();

      expect(router.navigate).toHaveBeenCalledWith(['/login']);
    });
  });
});
