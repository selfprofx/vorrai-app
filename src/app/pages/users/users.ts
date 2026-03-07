import { Component, OnInit, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { TableModule } from 'primeng/table';
import { InputTextModule } from 'primeng/inputtext';
import { IconField } from 'primeng/iconfield';
import { InputIcon } from 'primeng/inputicon';
import { Tag } from 'primeng/tag';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';
import { SkeletonModule } from 'primeng/skeleton';
import { NbSpinnerModule, NbCardModule } from '@nebular/theme';

import { User, UserExpandDetail } from '../../libs/model/user';
import { UserService } from '../../libs/service/user.service';
import { AppWsService } from '../../libs/service/app-ws.service';

type Severity = 'success' | 'danger' | 'info' | 'secondary' | 'warn' | 'contrast';

@Component({
  selector: 'users',
  imports: [
    CommonModule,
    TableModule,
    InputTextModule,
    Tag,
    IconField,
    InputIcon,
    ButtonModule,
    TooltipModule,
    SkeletonModule,
    NbSpinnerModule,
    NbCardModule,
  ],
  templateUrl: './users.html',
  styleUrl: './users.scss',
})
export class Users implements OnInit {
  private userService = inject(UserService);
  private appWs       = inject(AppWsService);
  private router      = inject(Router);

  users   = this.userService.users;
  loading = this.userService.loading;
  error   = this.userService.error;

  wsConnected = signal(false);

  expandedRows: Record<string, boolean> = {};
  expandCache: Record<string, UserExpandDetail> = {};
  expandLoading: Record<string, boolean> = {};

  globalFilterFields = [
    'id', 'full_name', 'email', 'phone',
    'utm_persona', 'chat_state', 'audience_state', 'followup_priority',
  ];

  tableDt = {
    header: { background: '#00b3c6', textColor: '#ffffff' },
    row:    { hoverBackground: '#00b3c622', selectedBackground: '#00b3c88a' },
    paginator: { background: '#00b3c6', textColor: '#ffffff' },
  };

  ngOnInit() {
    this.appWs.connect();
    this.appWs.on('ws_connected').subscribe(() => this.wsConnected.set(true));
    this.appWs.on('ws_disconnected').subscribe(() => this.wsConnected.set(false));
  }

  // --- Navigation ---

  openUser(user: User) {
    this.router.navigate(['/users', user.id]);
  }

  openChat(event: Event, user: User) {
    event.stopPropagation();
    this.router.navigate(['/users', user.id, 'chat']);
  }

  // --- Expand ---

  async toggleExpand(event: Event, user: User) {
    event.stopPropagation();
    const id = user.id;
    if (this.expandedRows[id]) {
      delete this.expandedRows[id];
      return;
    }
    this.expandedRows[id] = true;
    if (!this.expandCache[id]) {
      this.expandLoading[id] = true;
      const detail = await this.userService.getUserDetail(id);
      if (detail) this.expandCache[id] = detail;
      this.expandLoading[id] = false;
    }
  }

  // --- Funnel ---

  funnelStages(user: User): boolean[] {
    return [
      !!user.has_form,
      user.chat_state != null && user.chat_state !== 'START',
      !!user.has_meta,
      user.sequence_status != null,
      user.sequence_approval === 'approved' || user.sequence_approval === 'auto_approved',
      (user.email_sent_count ?? 0) > 0,
      !!user.has_appointment,
      !!user.offer_purchased,
    ];
  }

  funnelCount(user: User): number {
    return this.funnelStages(user).filter(Boolean).length;
  }

  funnelLabels = ['Form', 'Chat', 'Analyzed', 'Sequence', 'Approved', 'Delivered', 'Booked', 'Customer'];

  // --- Priority / Audience severity ---

  priorityWeight(p: string | null | undefined): number {
    switch (p) {
      case 'high':   return 3;
      case 'medium': return 2;
      case 'low':    return 1;
      default:       return 0;
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

  // --- Email stats ---

  emailLabel(user: User): string {
    const sent = user.email_sent_count ?? 0;
    const total = user.email_total_count ?? 0;
    if (total === 0) return '';
    const opens = user.email_open_count ?? 0;
    return opens > 0 ? `${sent}/${total} (${opens} opens)` : `${sent}/${total}`;
  }

  // --- Custom sort for priority column ---

  sortByPriority = (a: User, b: User): number => {
    return this.priorityWeight(b.followup_priority) - this.priorityWeight(a.followup_priority);
  };
}
