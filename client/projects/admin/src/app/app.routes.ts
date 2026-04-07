import { Routes } from '@angular/router';
import { authGuard } from 'auth';
import { AdminShellComponent } from './layout/admin-shell.component';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./login/login.page').then((m) => m.LoginPage),
  },
  {
    path: '',
    component: AdminShellComponent,
    canActivate: [authGuard],
    children: [
      {
        path: 'dashboard',
        loadComponent: () => import('./dashboard/dashboard.page').then((m) => m.DashboardPage),
      },
      {
        path: 'catalog',
        loadComponent: () => import('./catalog/catalog.page').then((m) => m.CatalogPage),
      },
      {
        path: 'orders',
        loadComponent: () => import('./orders/orders.page').then((m) => m.OrdersPage),
      },
      {
        path: 'orders/:id',
        loadComponent: () => import('./orders/order-detail.page').then((m) => m.OrderDetailPage),
      },
      {
        path: 'reports',
        loadComponent: () => import('./reports/reports.page').then((m) => m.ReportsPage),
      },
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
    ],
  },
  { path: '**', redirectTo: 'login' },
];
