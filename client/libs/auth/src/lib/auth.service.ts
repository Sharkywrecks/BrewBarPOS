import { Injectable, Inject, signal, computed } from '@angular/core';
import { Router } from '@angular/router';
import { CLIENT_TOKEN, IClient, UserDto, StaffDto, PinLoginDto, InitialSetupDto } from 'api-client';
import { firstValueFrom } from 'rxjs';

const TOKEN_KEY = 'brewbar_token';

@Injectable({ providedIn: 'root' })
export class AuthService {
  readonly currentUser = signal<UserDto | null>(null);
  readonly isAuthenticated = computed(() => !!this.currentUser());
  readonly authMethod = computed(() => this.currentUser()?.authMethod ?? null);
  readonly isPasswordAuthenticated = computed(() => this.authMethod() === 'password');
  /**
   * True when the current user has a role that's allowed to use the admin panel.
   * Note: this only gates *visibility* of the entry point. The admin app's own
   * `adminAuthGuard` still requires a password-issued token, so a pin-authenticated
   * admin will be sent to the admin login page when they click through.
   */
  readonly canAccessAdminPanel = computed(() => {
    const roles = this.currentUser()?.roles ?? [];
    return roles.includes('Admin') || roles.includes('Manager');
  });

  constructor(
    @Inject(CLIENT_TOKEN) private readonly client: IClient,
    private readonly router: Router,
  ) {}

  async getStaff(): Promise<StaffDto[]> {
    return firstValueFrom(this.client.auth_GetStaff());
  }

  /**
   * One-shot first-run bootstrap: creates the very first admin account. The
   * server rejects this with 409 as soon as any user exists, so it can only be
   * called on a brand-new install. On success, stores the JWT and sets the
   * current user just like a normal login.
   */
  async setup(dto: InitialSetupDto): Promise<UserDto> {
    const user = await firstValueFrom(this.client.auth_InitialSetup(dto));
    this.storeToken(user.token!);
    this.currentUser.set(user);
    return user;
  }

  async pinLogin(userId: string, pin: string): Promise<UserDto> {
    const dto: PinLoginDto = { userId, pin };
    const user = await firstValueFrom(this.client.auth_PinLogin(dto));
    this.storeToken(user.token!);
    this.currentUser.set(user);
    return user;
  }

  async loadStoredUser(): Promise<void> {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) return;

    try {
      const user = await firstValueFrom(this.client.auth_GetCurrentUser());
      this.currentUser.set(user);
    } catch {
      this.clearToken();
    }
  }

  logout(): void {
    this.clearToken();
    this.currentUser.set(null);
    this.router.navigate(['/login']);
  }

  private storeToken(token: string): void {
    localStorage.setItem(TOKEN_KEY, token);
  }

  private clearToken(): void {
    localStorage.removeItem(TOKEN_KEY);
  }
}
