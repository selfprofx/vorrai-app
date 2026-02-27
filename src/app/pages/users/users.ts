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
import { NbSpinnerModule, NbCardModule } from '@nebular/theme';

import { User } from '../../libs/model/user';
import { UserService } from '../../libs/service/user.service';
import { AppWsService } from '../../libs/service/app-ws.service';

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

  globalFilterFields = [
    'id', 'name', 'email', 'phone',
    'utm_persona', 'chat_state', 'character',
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

  openChat(user: User) {
    this.router.navigate(['/users', user.id, 'chat']);
  }

  getSeverityByChatState(state?: string | null): string {
    switch ((state || '').toLowerCase()) {
      case 'active':
      case 'synced':    return 'success';
      case 'onboarding':
      case 'start':     return 'info';
      case 'idle':      return 'warning';
      case 'blocked':
      case 'suspended': return 'danger';
      default:          return 'info';
    }
  }

  hasSocial(user: User): boolean {
    const s = user.social;
    return !!(s && (s.insta_id || s.whats_id || s.tiktok_id));
  }

  formFieldKeys(user: User): string[] {
    return Object.keys(user.form_fields ?? {}).slice(0, 4);
  }

  followupCount(user: User): number {
    return (user.followups ?? []).length;
  }
}
