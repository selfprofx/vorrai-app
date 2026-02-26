import { Routes } from '@angular/router';
import { Dashboard } from './pages/dashboard/dashboard';
import { Users } from './pages/users/users';
import { Chats } from './pages/chats/chats';
import { Bookings } from './pages/bookings/bookings';
import { Products } from './pages/products/products';
import { Contents } from './pages/contents/contents';
import { Courses } from './pages/courses/courses';
import { Council } from './pages/council/council';
import { Settings } from './pages/settings/settings';
import { Followups } from './pages/followups/followups';
import { ContentJobs } from './pages/content/content-jobs';
import { Login } from './pages/auth/login';
import { NewPassword } from './pages/auth/new-password';
import { authGuard } from './libs/guards/auth.guard';

export const routes: Routes = [
  // Auth routes (public)
  { path: 'auth/login', component: Login },
  { path: 'auth/new-password', component: NewPassword },

  // Default redirect
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },

  // Dashboard routes (Cognito-protected)
  { path: 'dashboard', component: Dashboard, canActivate: [authGuard] },
  { path: 'users', component: Users, canActivate: [authGuard] },
  { path: 'chats', component: Chats, canActivate: [authGuard] },
  { path: 'bookings', component: Bookings, canActivate: [authGuard] },
  { path: 'products', component: Products, canActivate: [authGuard] },
  { path: 'contents', component: Contents, canActivate: [authGuard] },
  { path: 'courses', component: Courses, canActivate: [authGuard] },
  { path: 'council', component: Council, canActivate: [authGuard] },
  { path: 'settings', component: Settings, canActivate: [authGuard] },
  { path: 'followups', component: Followups, canActivate: [authGuard] },
  { path: 'content-jobs', component: ContentJobs, canActivate: [authGuard] },
];
