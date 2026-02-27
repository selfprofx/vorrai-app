import { Routes } from '@angular/router';
import { authGuard } from './libs/guards/auth.guard';
import { managerGuard } from './libs/guards/manager.guard';

export const routes: Routes = [
  // Auth routes (public)
  { path: 'auth/login', loadComponent: () => import('./pages/auth/login').then(m => m.Login) },
  { path: 'auth/new-password', loadComponent: () => import('./pages/auth/new-password').then(m => m.NewPassword) },
  { path: 'auth/mfa', loadComponent: () => import('./pages/auth/mfa-challenge').then(m => m.MfaChallenge) },

  // Onboarding (public — auth via onboarding token, not Cognito)
  { path: 'onboarding', loadComponent: () => import('./pages/onboarding/onboarding').then(m => m.Onboarding) },

  // Default redirect
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },

  // Dashboard routes (Cognito-protected)
  { path: 'dashboard', loadComponent: () => import('./pages/dashboard/dashboard').then(m => m.Dashboard), canActivate: [authGuard] },
  { path: 'users', loadComponent: () => import('./pages/users/users').then(m => m.Users), canActivate: [authGuard] },
  { path: 'users/:userId/chat', loadComponent: () => import('./pages/users/user-chat/user-chat').then(m => m.UserChat), canActivate: [authGuard] },
  { path: 'chats', loadComponent: () => import('./pages/chats/chats').then(m => m.Chats), canActivate: [authGuard] },
  { path: 'bookings', loadComponent: () => import('./pages/bookings/bookings').then(m => m.Bookings), canActivate: [authGuard] },
  { path: 'products', loadComponent: () => import('./pages/products/products').then(m => m.Products), canActivate: [authGuard] },
  { path: 'contents', loadComponent: () => import('./pages/contents/contents').then(m => m.Contents), canActivate: [authGuard] },
  { path: 'courses', loadComponent: () => import('./pages/courses/courses').then(m => m.Courses), canActivate: [authGuard] },
  { path: 'council', loadComponent: () => import('./pages/council/council').then(m => m.Council), canActivate: [authGuard] },
  { path: 'settings', loadComponent: () => import('./pages/settings/settings').then(m => m.Settings), canActivate: [authGuard] },
  { path: 'followups', loadComponent: () => import('./pages/followups/followups').then(m => m.Followups), canActivate: [authGuard] },
  { path: 'content-jobs', loadComponent: () => import('./pages/content/content-jobs').then(m => m.ContentJobs), canActivate: [authGuard] },

  // Manager routes (managers Cognito group only)
  { path: 'manager', loadComponent: () => import('./pages/manager/manager-overview').then(m => m.ManagerOverview), canActivate: [managerGuard] },
  { path: 'manager/tenants', loadComponent: () => import('./pages/manager/manager-tenants').then(m => m.ManagerTenants), canActivate: [managerGuard] },
  { path: 'manager/tenants/:tenantId', loadComponent: () => import('./pages/manager/manager-tenant-detail').then(m => m.ManagerTenantDetail), canActivate: [managerGuard] },
];
