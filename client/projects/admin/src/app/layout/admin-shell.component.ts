import { Component } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { AuthService } from 'auth';

@Component({
  selector: 'app-admin-shell',
  standalone: true,
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    MatSidenavModule,
    MatToolbarModule,
    MatListModule,
    MatIconModule,
    MatButtonModule,
  ],
  template: `
    <mat-sidenav-container class="shell">
      <mat-sidenav mode="side" opened class="sidenav">
        <div class="brand">BrewBar Admin</div>
        <mat-nav-list>
          <a mat-list-item routerLink="/dashboard" routerLinkActive="active">
            <mat-icon matListItemIcon>dashboard</mat-icon>
            <span matListItemTitle>Dashboard</span>
          </a>
          <a mat-list-item routerLink="/catalog" routerLinkActive="active">
            <mat-icon matListItemIcon>restaurant_menu</mat-icon>
            <span matListItemTitle>Catalog</span>
          </a>
          <a mat-list-item routerLink="/orders" routerLinkActive="active">
            <mat-icon matListItemIcon>receipt_long</mat-icon>
            <span matListItemTitle>Orders</span>
          </a>
          <a mat-list-item routerLink="/reports" routerLinkActive="active">
            <mat-icon matListItemIcon>bar_chart</mat-icon>
            <span matListItemTitle>Reports</span>
          </a>
        </mat-nav-list>
      </mat-sidenav>

      <mat-sidenav-content class="content">
        <mat-toolbar>
          <span class="spacer"></span>
          <button mat-icon-button (click)="onLogout()">
            <mat-icon>logout</mat-icon>
          </button>
        </mat-toolbar>
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
      .sidenav {
        width: 240px;
        padding: 0;
      }
      .brand {
        padding: 16px 24px;
        font-size: 20px;
        font-weight: 600;
        border-bottom: 1px solid var(--mat-sys-outline-variant);
      }
      .content {
        display: flex;
        flex-direction: column;
      }
      .spacer {
        flex: 1;
      }
      .page {
        padding: 24px;
        flex: 1;
        overflow-y: auto;
      }
      .active {
        background-color: var(--mat-sys-secondary-container);
      }
    `,
  ],
})
export class AdminShellComponent {
  constructor(private readonly auth: AuthService) {}

  onLogout(): void {
    this.auth.logout();
  }
}
