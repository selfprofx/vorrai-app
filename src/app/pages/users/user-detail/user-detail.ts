import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { NbCardModule, NbSpinnerModule, NbIconModule, NbButtonModule } from '@nebular/theme';
import { Tag } from 'primeng/tag';
import { ButtonModule } from 'primeng/button';

import { User, UserExpandDetail } from '../../../libs/model/user';
import { UserService } from '../../../libs/service/user.service';

type Severity = 'success' | 'danger' | 'info' | 'secondary' | 'warn' | 'contrast';

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
  detail = signal<UserExpandDetail | null>(null);
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
      const [u, d] = await Promise.all([
        this.userService.getUser(userId),
        this.userService.getUserDetail(userId),
      ]);
      this.user.set(u);
      this.detail.set(d);
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

  getSeverity(state?: string | null): Severity {
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

  getSeverityByPriority(p?: string | null): Severity {
    switch (p) {
      case 'high':   return 'danger';
      case 'medium': return 'warn';
      case 'low':    return 'secondary';
      default:       return 'secondary';
    }
  }

  getSeverityByAudience(state?: string | null): Severity {
    switch (state) {
      case 'Urgency':     return 'danger';
      case 'Awareness':   return 'info';
      case 'Opportunity': return 'secondary';
      default:            return 'secondary';
    }
  }

  followupCount(): number {
    return this.detail()?.followups?.length ?? 0;
  }

  formFieldEntries(): [string, any][] {
    const ff = this.detail()?.form_fields;
    return ff ? Object.entries(ff) : [];
  }
}
