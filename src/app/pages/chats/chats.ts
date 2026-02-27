import { Component, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { NbCardModule, NbSpinnerModule, NbIconModule } from '@nebular/theme';
import { Tag } from 'primeng/tag';

import { UserService } from '../../libs/service/user.service';
import { User } from '../../libs/model/user';

/** Chats page — shows all users currently in an active SPIN conversation.
 *  Clicking a user navigates to /users/:id/chat to view the live conversation.
 */
@Component({
  selector: 'chats',
  imports: [CommonModule, NbCardModule, NbSpinnerModule, NbIconModule, Tag],
  templateUrl: './chats.html',
  styleUrl: './chats.scss',
})
export class Chats implements OnInit {
  private userService = inject(UserService);
  private router      = inject(Router);

  loading = this.userService.loading;
  error   = this.userService.error;

  activeUsers: User[] = [];

  private readonly ACTIVE_STATES = ['active', 'onboarding', 'start', 'in_progress'];

  ngOnInit() {
    this.userService.users.subscribe?.(() => this.refresh());
    this.refresh();
  }

  refresh() {
    const all = this.userService.users();
    this.activeUsers = all.filter(u =>
      this.ACTIVE_STATES.includes((u.chat_state ?? '').toLowerCase()),
    );
  }

  openChat(user: User) {
    this.router.navigate(['/users', user.id, 'chat']);
  }

  getSeverity(state?: string | null): string {
    switch ((state ?? '').toLowerCase()) {
      case 'active':
      case 'synced':    return 'success';
      case 'onboarding':
      case 'start':     return 'info';
      case 'idle':      return 'warning';
      case 'blocked':   return 'danger';
      default:          return 'info';
    }
  }
}
