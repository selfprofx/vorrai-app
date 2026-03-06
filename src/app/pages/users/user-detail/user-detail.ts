import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { NbCardModule, NbSpinnerModule, NbIconModule, NbButtonModule } from '@nebular/theme';
import { Tag } from 'primeng/tag';
import { ButtonModule } from 'primeng/button';

import { User } from '../../../libs/model/user';
import { UserService } from '../../../libs/service/user.service';

@Component({
  selector: 'user-detail',
  imports: [CommonModule, NbCardModule, NbSpinnerModule, NbIconModule, NbButtonModule, Tag, ButtonModule],
  templateUrl: './user-detail.html',
  styleUrl: './user-detail.scss',
})
export class UserDetail implements OnInit {
  private route       = inject(ActivatedRoute);
  private router      = inject(Router);
  private userService = inject(UserService);

  user = signal<User | null>(null);
  loading = signal(true);
  error = signal<string | null>(null);

  ngOnInit() {
    const userId = this.route.snapshot.paramMap.get('userId');
    if (!userId) {
      this.error.set('No user ID provided');
      this.loading.set(false);
      return;
    }
    this.loadUser(userId);
  }

  async loadUser(userId: string) {
    this.loading.set(true);
    try {
      const u = await this.userService.getUser(userId);
      this.user.set(u);
      if (!u) this.error.set('User not found');
    } catch (err: any) {
      this.error.set(err?.message ?? 'Failed to load user');
    } finally {
      this.loading.set(false);
    }
  }

  openChat() {
    const u = this.user();
    if (u) this.router.navigate(['/users', u.id, 'chat']);
  }

  goBack() {
    this.router.navigate(['/users']);
  }

  getSeverity(state?: string | null): 'success' | 'danger' | 'info' | 'secondary' | 'warn' | 'contrast' {
    switch ((state ?? '').toLowerCase()) {
      case 'active':
      case 'synced':    return 'success';
      case 'onboarding':
      case 'start':     return 'info';
      case 'idle':      return 'warn';
      case 'blocked':
      case 'suspended': return 'danger';
      default:          return 'info';
    }
  }

  followupCount(): number {
    return (this.user()?.followups ?? []).length;
  }

  formFieldEntries(): [string, any][] {
    const ff = this.user()?.form_fields;
    return ff ? Object.entries(ff) : [];
  }
}
