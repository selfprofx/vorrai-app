import { Component, OnInit, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { NbCardModule, NbSpinnerModule, NbIconModule, NbButtonModule } from '@nebular/theme';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Tag } from 'primeng/tag';

import { UserService } from '../../libs/service/user.service';
import { AppWsService } from '../../libs/service/app-ws.service';
import { LabelService } from '../../core/label.service';
import { LocaleService } from '../../core/locale.service';
import type { ConversationPreview } from '../../libs/model/conversation';

@Component({
  selector: 'chats',
  imports: [CommonModule, NbCardModule, NbSpinnerModule, NbIconModule, NbButtonModule, Tag, TranslatePipe],
  templateUrl: './chats.html',
  styleUrl: './chats.scss',
})
export class Chats implements OnInit {
  private userService = inject(UserService);
  private appWs       = inject(AppWsService);
  private router      = inject(Router);
  private translate   = inject(TranslateService);
  private locale      = inject(LocaleService);
  protected labels    = inject(LabelService).labels;

  conversations = signal<ConversationPreview[]>([]);
  loading = signal(false);
  error = signal<string | null>(null);
  nextCursor = signal<string | null>(null);
  loadingMore = signal(false);

  selectedConvo = signal<ConversationPreview | null>(null);
  messages = signal<any[]>([]);
  messagesLoading = signal(false);

  ngOnInit() {
    this.loadConversations();
    this.appWs.on('chat_update', 'new_user').subscribe(() => this.loadConversations());
  }

  async loadConversations(cursor?: string) {
    if (cursor) {
      this.loadingMore.set(true);
    } else {
      this.loading.set(true);
      this.error.set(null);
    }
    try {
      const result = await this.userService.getConversations(cursor);
      if (cursor) {
        this.conversations.update(prev => [...prev, ...result.items]);
      } else {
        this.conversations.set(result.items);
      }
      this.nextCursor.set(result.next_cursor ?? null);
    } catch (err: any) {
      if (!cursor) this.error.set(err?.message ?? this.translate.instant('chats.loadFailed'));
    } finally {
      this.loading.set(false);
      this.loadingMore.set(false);
    }
  }

  loadMore() {
    const cursor = this.nextCursor();
    if (cursor && !this.loadingMore()) this.loadConversations(cursor);
  }

  onScroll(event: Event) {
    const el = event.target as HTMLElement;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 100) {
      this.loadMore();
    }
  }

  async selectConvo(convo: ConversationPreview) {
    this.selectedConvo.set(convo);
    this.messagesLoading.set(true);
    try {
      const msgs = await this.userService.getChatHistory(convo.user_id);
      this.messages.set(msgs);
    } catch {
      this.messages.set([]);
    } finally {
      this.messagesLoading.set(false);
    }
  }

  openUserDetail(userId: string, event: Event) {
    event.stopPropagation();
    this.router.navigate(['/users', userId]);
  }

  formatTime(ts: any): string {
    if (!ts) return '';
    const n = typeof ts === 'number' ? (ts > 1e12 ? ts : ts * 1000) : Date.parse(ts);
    return isNaN(n) ? String(ts) : this.locale.formatDate(n, { dateStyle: 'short', timeStyle: 'short' });
  }

  getSeverity(state?: string | null): 'success' | 'danger' | 'info' | 'secondary' | 'warn' | 'contrast' {
    switch ((state ?? '').toLowerCase()) {
      case 'active':
      case 'synced':    return 'success';
      case 'onboarding':
      case 'start':     return 'info';
      case 'idle':      return 'warn';
      case 'blocked':   return 'danger';
      default:          return 'info';
    }
  }
}
