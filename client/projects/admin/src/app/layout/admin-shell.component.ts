import { Component, inject } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { AuthService } from 'auth';

@Component({
  selector: 'app-admin-shell',
  standalone: true,
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    MatSidenavModule,
    MatIconModule,
    MatButtonModule,
    MatTooltipModule,
  ],
  template: `
    <mat-sidenav-container class="shell">
      <mat-sidenav mode="side" opened class="sidenav">
        <!-- Brand -->
        <a routerLink="/dashboard" class="brand">
          <mat-icon class="brand-icon">local_cafe</mat-icon>
          <div class="brand-text">
            <span class="brand-name">BrewBar</span>
            <span class="brand-label">Admin</span>
          </div>
        </a>

        <!-- Main nav -->
        <nav class="nav-section">
          <span class="nav-heading">Overview</span>
          <a routerLink="/dashboard" routerLinkActive="active" class="nav-item">
            <mat-icon>space_dashboard</mat-icon>
            <span>Dashboard</span>
          </a>
        </nav>

        <nav class="nav-section">
          <span class="nav-heading">Menu</span>
          <a routerLink="/catalog" routerLinkActive="active" class="nav-item">
            <mat-icon>restaurant_menu</mat-icon>
            <span>Catalog</span>
          </a>
          <a routerLink="/menu-import" routerLinkActive="active" class="nav-item">
            <mat-icon>upload_file</mat-icon>
            <span>Menu Import</span>
          </a>
        </nav>

        <nav class="nav-section">
          <span class="nav-heading">Sales</span>
          <a routerLink="/orders" routerLinkActive="active" class="nav-item">
            <mat-icon>receipt_long</mat-icon>
            <span>Orders</span>
          </a>
          <a routerLink="/reports" routerLinkActive="active" class="nav-item">
            <mat-icon>bar_chart</mat-icon>
            <span>Reports</span>
          </a>
        </nav>

        <nav class="nav-section">
          <span class="nav-heading">System</span>
          <a routerLink="/staff" routerLinkActive="active" class="nav-item">
            <mat-icon>group</mat-icon>
            <span>Staff</span>
          </a>
          <a routerLink="/terminals" routerLinkActive="active" class="nav-item">
            <mat-icon>point_of_sale</mat-icon>
            <span>Terminals</span>
          </a>
          <a routerLink="/settings" routerLinkActive="active" class="nav-item">
            <mat-icon>settings</mat-icon>
            <span>Settings</span>
          </a>
        </nav>

        <!-- Bottom user area -->
        <div class="sidebar-footer">
          <div class="user-info">
            <div class="user-avatar">
              <mat-icon>person</mat-icon>
            </div>
            <span class="user-name">{{ auth.currentUser()?.displayName ?? 'Admin' }}</span>
          </div>
          <button mat-icon-button matTooltip="Logout" (click)="onLogout()" class="logout-btn">
            <mat-icon>logout</mat-icon>
          </button>
        </div>
      </mat-sidenav>

      <mat-sidenav-content class="content">
        <main class="page">
          <router-outlet />
        </main>
      </mat-sidenav-content>
    </mat-sidenav-container>
  `,
  styles: [
    `
      .shell {
        height: 100vh;
      }

      /* ── Sidebar ── */
      .sidenav {
        width: 248px;
        border-right: 1px solid var(--mat-sys-outline-variant) !important;
        display: flex;
        flex-direction: column;
      }
      ::ng-deep .sidenav .mat-drawer-inner-container {
        display: flex;
        flex-direction: column;
      }

      /* Brand */
      .brand {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 20px 20px 16px;
        text-decoration: none;
        color: var(--mat-sys-on-surface);
      }
      .brand-icon {
        font-size: 28px;
        width: 28px;
        height: 28px;
        display: flex;
        align-items: center;
        justify-content: center;
        color: var(--mat-sys-primary);
      }
      .brand-text {
        display: flex;
        flex-direction: column;
        line-height: 1.1;
      }
      .brand-name {
        font-size: 18px;
        font-weight: 800;
        letter-spacing: 0.3px;
      }
      .brand-label {
        font-size: 11px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 1.5px;
        color: var(--mat-sys-on-surface-variant);
      }

      /* Nav sections */
      .nav-section {
        padding: 4px 12px;
      }
      .nav-heading {
        display: block;
        font-size: 11px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.8px;
        color: var(--mat-sys-on-surface-variant);
        padding: 16px 12px 6px;
      }

      /* Nav items */
      .nav-item {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 0 12px;
        height: 40px;
        border-radius: 10px;
        text-decoration: none;
        color: var(--mat-sys-on-surface-variant);
        font-size: 14px;
        font-weight: 500;
        transition:
          background 0.15s,
          color 0.15s;
      }
      .nav-item mat-icon {
        font-size: 20px;
        width: 20px;
        height: 20px;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .nav-item:hover {
        background: var(--mat-sys-surface-container-high);
        color: var(--mat-sys-on-surface);
      }
      .nav-item.active {
        background: var(--mat-sys-primary-container);
        color: var(--mat-sys-on-primary-container);
        font-weight: 600;
      }

      /* Footer / user area */
      .sidebar-footer {
        margin-top: auto;
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 12px 16px;
        border-top: 1px solid var(--mat-sys-outline-variant);
      }
      .user-info {
        display: flex;
        align-items: center;
        gap: 10px;
        min-width: 0;
      }
      .user-avatar {
        width: 32px;
        height: 32px;
        border-radius: 50%;
        background: var(--mat-sys-primary-container);
        color: var(--mat-sys-on-primary-container);
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
      }
      .user-avatar mat-icon {
        font-size: 20px;
        width: 20px;
        height: 20px;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .user-name {
        font-size: 13px;
        font-weight: 500;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .logout-btn {
        flex-shrink: 0;
        color: var(--mat-sys-on-surface-variant);
      }
      .logout-btn:hover {
        color: var(--mat-sys-error);
      }

      /* ── Content area ── */
      .content {
        display: flex;
        flex-direction: column;
        background: var(--mat-sys-surface);
      }
      .page {
        padding: 24px;
        flex: 1;
        overflow-y: auto;
      }
    `,
  ],
})
export class AdminShellComponent {
  protected readonly auth = inject(AuthService);

  onLogout(): void {
    this.auth.logout();
  }
}
