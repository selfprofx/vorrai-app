import { Routes } from '@angular/router';
import { authGuard } from './libs/guards/auth.guard';
import { managerGuard } from './libs/guards/manager.guard';

export const routes: Routes = [
  // Auth routes (public)
  { path: 'auth/login', loadComponent: () => import('./pages/auth/login').then(m => m.Login) },
  { path: 'auth/new-password', loadComponent: () => import('./pages/auth/new-password').then(m => m.NewPassword) },
  { path: 'auth/mfa', loadComponent: () => import('./pages/auth/mfa-challenge').then(m => m.MfaChallenge) },
  { path: 'auth/signup', loadComponent: () => import('./pages/auth/signup').then(m => m.Signup) },

  // Onboarding (public — auth via onboarding token, not Cognito)
  { path: 'onboarding', loadComponent: () => import('./pages/onboarding/onboarding').then(m => m.Onboarding) },

  // Default redirect
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },

  // Dashboard routes (Cognito-protected)
  { path: 'dashboard', loadComponent: () => import('./pages/dashboard/dashboard').then(m => m.Dashboard), canActivate: [authGuard] },
  { path: 'users', loadComponent: () => import('./pages/users/users').then(m => m.Users), canActivate: [authGuard] },
  { path: 'users/:userId', loadComponent: () => import('./pages/users/user-detail/user-detail').then(m => m.UserDetail), canActivate: [authGuard] },
  { path: 'users/:userId/chat', loadComponent: () => import('./pages/users/user-chat/user-chat').then(m => m.UserChat), canActivate: [authGuard] },
  { path: 'chats', loadComponent: () => import('./pages/chats/chats').then(m => m.Chats), canActivate: [authGuard] },
  { path: 'bookings', loadComponent: () => import('./pages/bookings/bookings').then(m => m.Bookings), canActivate: [authGuard] },
  { path: 'products', loadComponent: () => import('./pages/products/products').then(m => m.Products), canActivate: [authGuard] },
  { path: 'contents', loadComponent: () => import('./pages/contents/contents').then(m => m.Contents), canActivate: [authGuard] },
  { path: 'courses', loadComponent: () => import('./pages/courses/courses').then(m => m.Courses), canActivate: [authGuard] },
  { path: 'personas', loadComponent: () => import('./pages/council/council').then(m => m.Council), canActivate: [authGuard] },
  { path: 'council', redirectTo: 'personas', pathMatch: 'full' },
  { path: 'offers', loadComponent: () => import('./pages/offers/offers').then(m => m.Offers), canActivate: [authGuard] },
  { path: 'settings', loadComponent: () => import('./pages/settings/settings').then(m => m.Settings), canActivate: [authGuard] },
  { path: 'followups', loadComponent: () => import('./pages/followups/followups').then(m => m.Followups), canActivate: [authGuard] },
  { path: 'content-jobs', loadComponent: () => import('./pages/content/content-jobs').then(m => m.ContentJobs), canActivate: [authGuard] },
  { path: 'email-templates', loadComponent: () => import('./pages/email-templates/email-templates').then(m => m.EmailTemplates), canActivate: [authGuard] },
  { path: 'notifications', loadComponent: () => import('./pages/notifications/notifications').then(m => m.Notifications), canActivate: [authGuard] },

  // Manager routes (managers Cognito group only)
  { path: 'manager', loadComponent: () => import('./pages/manager/manager-overview').then(m => m.ManagerOverview), canActivate: [managerGuard] },
  { path: 'manager/tenants', loadComponent: () => import('./pages/manager/manager-tenants').then(m => m.ManagerTenants), canActivate: [managerGuard] },
  { path: 'manager/tenants/:tenantId', loadComponent: () => import('./pages/manager/manager-tenant-detail').then(m => m.ManagerTenantDetail), canActivate: [managerGuard] },
  { path: 'manager/usage', loadComponent: () => import('./pages/manager/manager-usage').then(m => m.ManagerUsage), canActivate: [managerGuard] },
  { path: 'manager/global-config', loadComponent: () => import('./pages/manager/manager-global-config').then(m => m.ManagerGlobalConfig), canActivate: [managerGuard] },
];
