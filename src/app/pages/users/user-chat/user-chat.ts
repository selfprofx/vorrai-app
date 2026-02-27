import { Component, OnInit, OnDestroy, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { NbCardModule, NbSpinnerModule, NbButtonModule, NbIconModule, NbBadgeModule } from '@nebular/theme';
import { Tag } from 'primeng/tag';
import { Subscription } from 'rxjs';

import { UserService } from '../../../libs/service/user.service';
import { AppWsService } from '../../../libs/service/app-ws.service';
import { User } from '../../../libs/model/user';

export interface ChatMessage {
  msg_id?: string;
  timestamp: number;
  datetime?: string;
  user_message?: string;
  ai_response?: string;
  spin_state?: string;
}

@Component({
  selector: 'user-chat',
  imports: [
    CommonModule,
    NbCardModule,
    NbSpinnerModule,
    NbButtonModule,
    NbIconModule,
    NbBadgeModule,
    Tag,
  ],
  templateUrl: './user-chat.html',
  styleUrl: './user-chat.scss',
})
export class UserChat implements OnInit, OnDestroy {
  private route       = inject(ActivatedRoute);
  private router      = inject(Router);
  private userService = inject(UserService);
  private appWs       = inject(AppWsService);

  userId  = signal<string>('');
  user    = signal<User | null>(null);
  messages = signal<ChatMessage[]>([]);
  loading  = signal(false);
  error    = signal<string | null>(null);
  isLive   = signal(false);   // true if chat is currently active

  private wsSub?: Subscription;

  async ngOnInit() {
    const id = this.route.snapshot.paramMap.get('userId') ?? '';
    this.userId.set(id);
    await this.loadAll(id);

    // Subscribe to live chat_update events for this user
    this.wsSub = this.appWs.on('chat_update').subscribe(evt => {
      if (evt['user_id'] === id) {
        this.loadMessages(id);
      }
    });
  }

  ngOnDestroy() {
    this.wsSub?.unsubscribe();
  }

  async loadAll(userId: string) {
    this.loading.set(true);
    this.error.set(null);
    try {
      const [user, messages] = await Promise.all([
        this.userService.getUser(userId),
        this.userService.getChatHistory(userId),
      ]);
      this.user.set(user);
      this.messages.set(messages as ChatMessage[]);

      const activeStates = ['active', 'onboarding', 'start'];
      const state = (user?.chat_state ?? '').toLowerCase();
      this.isLive.set(activeStates.includes(state));
    } catch (err: any) {
      this.error.set('Failed to load conversation.');
    } finally {
      this.loading.set(false);
    }
  }

  async loadMessages(userId: string) {
    const messages = await this.userService.getChatHistory(userId);
    this.messages.set(messages as ChatMessage[]);
  }

  goBack() {
    this.router.navigate(['/users']);
  }

  getSeverity(state?: string | null): string {
    switch ((state ?? '').toLowerCase()) {
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

  formatTime(ts: number): string {
    if (!ts) return '';
    const d = new Date(ts > 1e12 ? ts : ts * 1000);
    return d.toLocaleString();
  }
}
