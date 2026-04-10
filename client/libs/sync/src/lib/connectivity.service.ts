import { Injectable, Inject, signal, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { API_BASE_URL } from 'api-client';
import { firstValueFrom } from 'rxjs';

const HEARTBEAT_INTERVAL_MS = 15_000; // Check every 15 seconds

@Injectable({ providedIn: 'root' })
export class ConnectivityService implements OnDestroy {
  private intervalId: ReturnType<typeof setInterval> | null = null;

  /** Whether the backend API is reachable. */
  readonly isOnline = signal(true);

  constructor(
    private readonly http: HttpClient,
    @Inject(API_BASE_URL) private readonly baseUrl: string,
  ) {}

  /** Start the heartbeat polling loop. Call once at app startup. */
  start(): void {
    if (this.intervalId) return;
    this.check();
    this.intervalId = setInterval(() => this.check(), HEARTBEAT_INTERVAL_MS);
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  ngOnDestroy(): void {
    this.stop();
  }

  /** Perform a single connectivity check against /health/ready. */
  async check(): Promise<boolean> {
    try {
      await firstValueFrom(this.http.get(`${this.baseUrl}/health/ready`, { responseType: 'text' }));
      this.isOnline.set(true);
      return true;
    } catch {
      this.isOnline.set(false);
      return false;
    }
  }
}
