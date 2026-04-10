import { Injectable, Inject, NgZone, signal, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { API_BASE_URL } from 'api-client';
import { firstValueFrom, catchError, of, map } from 'rxjs';

const HEARTBEAT_INTERVAL_MS = 15_000; // Check every 15 seconds

@Injectable({ providedIn: 'root' })
export class ConnectivityService implements OnDestroy {
  private intervalId: ReturnType<typeof setInterval> | null = null;

  /** Whether the backend API is reachable. */
  readonly isOnline = signal(true);

  constructor(
    private readonly http: HttpClient,
    private readonly ngZone: NgZone,
    @Inject(API_BASE_URL) private readonly baseUrl: string,
  ) {}

  /** Start the heartbeat polling loop. Call once at app startup. */
  start(): void {
    if (this.intervalId) return;
    // Defer the first check so it doesn't fire during APP_INITIALIZER,
    // where HTTP errors can trigger NG0203 via zone.js error handling.
    setTimeout(() => this.check(), 1000);
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
    // Run outside Angular zone so HTTP errors don't trigger the global ErrorHandler
    const online = await this.ngZone.runOutsideAngular(() =>
      firstValueFrom(
        this.http.get(`${this.baseUrl}/health/ready`, { responseType: 'text' }).pipe(
          map(() => true),
          catchError(() => of(false)),
        ),
      ),
    );
    this.isOnline.set(online);
    return online;
  }
}
