import { Component, OnInit, OnDestroy, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { NbCardModule, NbSpinnerModule, NbButtonModule, NbIconModule, NbBadgeModule, NbTabsetModule } from '@nebular/theme';
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

export interface PretriageRecord {
  appointment_id: string | null;
  status: string;
  consent_snapshot: any;
  summary: any;
  red_flags_self_reported: string[];
  ai_model_used?: string;
  ai_model_version?: string;
  doctor_notes?: string;
  created_at: string;
  completed_at?: string;
  reviewed_at?: string;
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
    NbTabsetModule,
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
  pretriage = signal<PretriageRecord | null>(null);
  loading  = signal(false);
  error    = signal<string | null>(null);
  isLive   = signal(false);   // true if chat is currently active

  private wsSub?: Subscription;
  private wsPretriageSub?: Subscription;

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

    // Vorrai Clinical: refresh pre-triage on completion / human escalation
    this.wsPretriageSub = this.appWs
      .on('pretriage_complete', 'pretriage_requires_human')
      .subscribe(evt => {
        if (evt['user_id'] === id) {
          this.loadPretriage(id);
        }
      });
  }

  ngOnDestroy() {
    this.wsSub?.unsubscribe();
    this.wsPretriageSub?.unsubscribe();
  }

  async loadAll(userId: string) {
    this.loading.set(true);
    this.error.set(null);
    try {
      const [user, messages, pretriage] = await Promise.all([
        this.userService.getUser(userId),
        this.userService.getChatHistory(userId),
        this.userService.getPretriage(userId),
      ]);
      this.user.set(user);
      this.messages.set(messages as ChatMessage[]);
      this.pretriage.set(pretriage as PretriageRecord | null);

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

  async loadPretriage(userId: string) {
    const pretriage = await this.userService.getPretriage(userId);
    this.pretriage.set(pretriage as PretriageRecord | null);
  }

  /** Called when the doctor opens the Pre-Triage tab — flip status to reviewed. */
  onPretriageTabOpen() {
    const p = this.pretriage();
    if (p && p.status === 'complete' && p.created_at) {
      this.userService.markPretriageReviewed(this.userId(), p.created_at);
    }
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

  formatTime(ts: number): string {
    if (!ts) return '';
    const d = new Date(ts > 1e12 ? ts : ts * 1000);
    return d.toLocaleString();
  }

  /** Convert ISO 8601 timestamp to epoch ms for formatTime(). */
  parseIso(iso?: string | null): number {
    if (!iso) return 0;
    const t = Date.parse(iso);
    return isNaN(t) ? 0 : t;
  }
}
