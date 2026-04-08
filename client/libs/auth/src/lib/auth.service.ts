import { Injectable, Inject, signal, computed } from '@angular/core';
import { Router } from '@angular/router';
import { CLIENT_TOKEN, IClient, UserDto, StaffDto, PinLoginDto } from 'api-client';
import { firstValueFrom } from 'rxjs';

const TOKEN_KEY = 'brewbar_token';

@Injectable({ providedIn: 'root' })
export class AuthService {
  readonly currentUser = signal<UserDto | null>(null);
  readonly isAuthenticated = computed(() => !!this.currentUser());

  constructor(
    @Inject(CLIENT_TOKEN) private readonly client: IClient,
    private readonly router: Router,
  ) {}

  async getStaff(): Promise<StaffDto[]> {
    return firstValueFrom(this.client.auth_GetStaff());
  }

  async pinLogin(pin: string): Promise<UserDto> {
    const dto: PinLoginDto = { pin };
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
