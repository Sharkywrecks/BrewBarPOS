import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { AuthService } from './auth.service';
import { CLIENT_TOKEN, IClient, UserDto } from 'api-client';

function makeMockClient(): Partial<IClient> {
  return {
    auth_PinLogin: vi.fn(),
    auth_GetCurrentUser: vi.fn(),
    auth_InitialSetup: vi.fn(),
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

      const result = await service.pinLogin('user-1', '1234');

      expect(result).toEqual(user);
      expect(service.currentUser()).toEqual(user);
      expect(service.isAuthenticated()).toBe(true);
    });

    it('should store token in localStorage', async () => {
      const user = makeUser({ token: 'my-jwt' });
      (client.auth_PinLogin as ReturnType<typeof vi.fn>).mockReturnValue(of(user));

      await service.pinLogin('user-1', '1234');

      expect(localStorage.getItem('brewbar_token')).toBe('my-jwt');
    });

    it('should call API with correct userId and pin', async () => {
      (client.auth_PinLogin as ReturnType<typeof vi.fn>).mockReturnValue(of(makeUser()));

      await service.pinLogin('user-42', '9999');

      expect(client.auth_PinLogin).toHaveBeenCalledWith({ userId: 'user-42', pin: '9999' });
    });
  });

  describe('setup', () => {
    const dto = {
      displayName: 'Cafe Owner',
      email: 'owner@cafe.local',
      password: 'OwnerPass123!',
      pin: '4242',
    };

    it('calls auth_InitialSetup and stores the returned token', async () => {
      const user = makeUser({ token: 'setup-jwt', authMethod: 'password', roles: ['Admin'] });
      (client.auth_InitialSetup as ReturnType<typeof vi.fn>).mockReturnValue(of(user));

      const result = await service.setup(dto);

      expect(client.auth_InitialSetup).toHaveBeenCalledWith(dto);
      expect(result).toEqual(user);
      expect(service.currentUser()).toEqual(user);
      expect(localStorage.getItem('brewbar_token')).toBe('setup-jwt');
    });

    it('propagates errors so the page can render them', async () => {
      (client.auth_InitialSetup as ReturnType<typeof vi.fn>).mockReturnValue(
        throwError(() => new HttpErrorResponse({ status: 409, statusText: 'Conflict' })),
      );

      await expect(service.setup(dto)).rejects.toMatchObject({ status: 409 });
      expect(service.currentUser()).toBeNull();
      expect(localStorage.getItem('brewbar_token')).toBeNull();
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

  describe('authMethod', () => {
    it('should expose null authMethod when no user', () => {
      expect(service.authMethod()).toBeNull();
      expect(service.isPasswordAuthenticated()).toBe(false);
    });

    it('should expose pin authMethod after pin login', async () => {
      const user = makeUser({ authMethod: 'pin' });
      (client.auth_PinLogin as ReturnType<typeof vi.fn>).mockReturnValue(of(user));

      await service.pinLogin('user-1', '1234');

      expect(service.authMethod()).toBe('pin');
      expect(service.isPasswordAuthenticated()).toBe(false);
    });

    it('should expose password authMethod after loading a password-issued token', async () => {
      localStorage.setItem('brewbar_token', 'stored-jwt');
      (client.auth_GetCurrentUser as ReturnType<typeof vi.fn>).mockReturnValue(
        of(makeUser({ authMethod: 'password' })),
      );

      await service.loadStoredUser();

      expect(service.authMethod()).toBe('password');
      expect(service.isPasswordAuthenticated()).toBe(true);
    });

    it('should reset authMethod on logout', async () => {
      (client.auth_PinLogin as ReturnType<typeof vi.fn>).mockReturnValue(
        of(makeUser({ authMethod: 'pin' })),
      );
      await service.pinLogin('user-1', '1234');

      service.logout();

      expect(service.authMethod()).toBeNull();
      expect(service.isPasswordAuthenticated()).toBe(false);
    });
  });

  describe('canAccessAdminPanel', () => {
    it('should be false when no user is signed in', () => {
      expect(service.canAccessAdminPanel()).toBe(false);
    });

    it('should be false for a Cashier-only user', async () => {
      (client.auth_PinLogin as ReturnType<typeof vi.fn>).mockReturnValue(
        of(makeUser({ roles: ['Cashier'] })),
      );
      await service.pinLogin('user-1', '1234');

      expect(service.canAccessAdminPanel()).toBe(false);
    });

    it('should be true for an Admin user', async () => {
      (client.auth_PinLogin as ReturnType<typeof vi.fn>).mockReturnValue(
        of(makeUser({ roles: ['Admin'] })),
      );
      await service.pinLogin('user-1', '1234');

      expect(service.canAccessAdminPanel()).toBe(true);
    });

    it('should be true for a Manager user', async () => {
      (client.auth_PinLogin as ReturnType<typeof vi.fn>).mockReturnValue(
        of(makeUser({ roles: ['Manager'] })),
      );
      await service.pinLogin('user-1', '1234');

      expect(service.canAccessAdminPanel()).toBe(true);
    });

    it('should be true for a user with multiple roles including Admin', async () => {
      (client.auth_PinLogin as ReturnType<typeof vi.fn>).mockReturnValue(
        of(makeUser({ roles: ['Cashier', 'Admin'] })),
      );
      await service.pinLogin('user-1', '1234');

      expect(service.canAccessAdminPanel()).toBe(true);
    });

    it('should be false again after logout', async () => {
      (client.auth_PinLogin as ReturnType<typeof vi.fn>).mockReturnValue(
        of(makeUser({ roles: ['Admin'] })),
      );
      await service.pinLogin('user-1', '1234');
      service.logout();

      expect(service.canAccessAdminPanel()).toBe(false);
    });
  });

  describe('logout', () => {
    it('should clear user and token', async () => {
      // First log in
      (client.auth_PinLogin as ReturnType<typeof vi.fn>).mockReturnValue(of(makeUser()));
      await service.pinLogin('user-1', '1234');

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
