import { Routes } from '@angular/router';
import { authGuard } from 'auth';
import { PosShellComponent } from './layout/pos-shell.component';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./login/login.page').then((m) => m.LoginPage),
  },
  {
    path: '',
    component: PosShellComponent,
    canActivate: [authGuard],
    children: [
      {
        path: 'register',
        loadComponent: () => import('./register/register.page').then((m) => m.RegisterPage),
      },
      {
        path: 'checkout',
        loadComponent: () => import('./checkout/checkout.page').then((m) => m.CheckoutPage),
      },
      {
        path: 'order-complete',
        loadComponent: () =>
          import('./order-complete/order-complete.page').then((m) => m.OrderCompletePage),
      },
      { path: '', redirectTo: 'register', pathMatch: 'full' },
    ],
  },
  { path: '**', redirectTo: 'login' },
];
