import { Component, OnInit, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { NbCardModule, NbSpinnerModule, NbIconModule } from '@nebular/theme';
import { Tag } from 'primeng/tag';

import { UserService } from '../../libs/service/user.service';
import { AppWsService } from '../../libs/service/app-ws.service';
import type { ConversationPreview } from '../../libs/model/conversation';

@Component({
  selector: 'chats',
  imports: [CommonModule, NbCardModule, NbSpinnerModule, NbIconModule, Tag, RouterLink],
  templateUrl: './chats.html',
  styleUrl: './chats.scss',
})
export class Chats implements OnInit {
  private userService = inject(UserService);
  private appWs       = inject(AppWsService);
  private router      = inject(Router);

  conversations = signal<ConversationPreview[]>([]);
  loading = signal(false);
  error = signal<string | null>(null);

  selectedConvo = signal<ConversationPreview | null>(null);
  messages = signal<any[]>([]);
  messagesLoading = signal(false);

  ngOnInit() {
    this.loadConversations();
    this.appWs.on('chat_update', 'new_user').subscribe(() => this.loadConversations());
  }

  async loadConversations() {
    this.loading.set(true);
    this.error.set(null);
    try {
      const convos = await this.userService.getConversations();
      this.conversations.set(convos);
    } catch (err: any) {
      this.error.set(err?.message ?? 'Failed to load conversations');
    } finally {
      this.loading.set(false);
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
    return isNaN(n) ? String(ts) : new Date(n).toLocaleString();
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
