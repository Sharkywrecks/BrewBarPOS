import { Component } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [MatCardModule, MatIconModule],
  template: `
    <h1>Dashboard</h1>
    <div class="cards">
      <mat-card>
        <mat-card-content>
          <mat-icon class="card-icon">restaurant_menu</mat-icon>
          <div class="card-label">Catalog</div>
          <div class="card-hint">Manage categories, products, and modifiers</div>
        </mat-card-content>
      </mat-card>
      <mat-card>
        <mat-card-content>
          <mat-icon class="card-icon">receipt_long</mat-icon>
          <div class="card-label">Orders</div>
          <div class="card-hint">View order history and details</div>
        </mat-card-content>
      </mat-card>
      <mat-card>
        <mat-card-content>
          <mat-icon class="card-icon">bar_chart</mat-icon>
          <div class="card-label">Reports</div>
          <div class="card-hint">Coming soon</div>
        </mat-card-content>
      </mat-card>
    </div>
  `,
  styles: [
    `
      .cards {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
        gap: 16px;
        margin-top: 16px;
      }
      .card-icon {
        font-size: 36px;
        width: 36px;
        height: 36px;
        color: var(--mat-sys-primary);
        margin-bottom: 8px;
      }
      .card-label {
        font-size: 18px;
        font-weight: 500;
      }
      .card-hint {
        font-size: 14px;
        opacity: 0.7;
        margin-top: 4px;
      }
    `,
  ],
})
export class DashboardPage {}
