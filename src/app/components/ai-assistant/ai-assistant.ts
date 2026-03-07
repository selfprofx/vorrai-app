import {
  Component,
  inject,
  signal,
  computed,
  ElementRef,
  ViewChild,
  AfterViewChecked,
  OnInit,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AiLogoSvgComponent } from './ai-logo-svg';
import { AiChatService } from '../../libs/service/ai-chat.service';
import { AuthService } from '../../libs/service/auth.service';
import type { AiActionButton } from '../../libs/model/ai-chat';

@Component({
  selector: 'app-ai-assistant',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, AiLogoSvgComponent],
  templateUrl: './ai-assistant.html',
  styleUrl: './ai-assistant.scss',
})
export class AiAssistantComponent implements OnInit, AfterViewChecked {
  private auth    = inject(AuthService);
  private router  = inject(Router);
  readonly chat   = inject(AiChatService);

  @ViewChild('messagesEnd') private messagesEnd!: ElementRef<HTMLDivElement>;

  readonly inputText    = signal('');
  readonly showSessions = signal(false);
  readonly renameId     = signal<string | null>(null);
  readonly renameText   = signal('');

  readonly visible   = computed(() => this.auth.isAuthenticated());

  private _shouldScroll = false;

  ngOnInit(): void {}

  ngAfterViewChecked(): void {
    if (this._shouldScroll) {
      this._scrollToBottom();
      this._shouldScroll = false;
    }
  }

  toggle(): void {
    this.chat.toggle();
    if (this.chat.isOpen()) {
      this._shouldScroll = true;
    }
  }

  onPinToggle(): void {
    this.chat.togglePin();
  }

  onToggleSessions(): void {
    this.showSessions.update(v => !v);
  }

  async onNewChat(): Promise<void> {
    await this.chat.startNewChat();
    this.showSessions.set(false);
    this._shouldScroll = true;
  }

  async onSelectSession(sessionId: string): Promise<void> {
    await this.chat.switchSession(sessionId);
    this.showSessions.set(false);
    this._shouldScroll = true;
  }

  onStartRename(sessionId: string, currentTitle: string | null): void {
    this.renameId.set(sessionId);
    this.renameText.set(currentTitle || '');
  }

  async onConfirmRename(): Promise<void> {
    const id = this.renameId();
    const title = this.renameText().trim();
    if (id && title) {
      await this.chat.renameSession(id, title);
    }
    this.renameId.set(null);
  }

  onCancelRename(): void {
    this.renameId.set(null);
  }

  async onDeleteSession(sessionId: string): Promise<void> {
    await this.chat.deleteSession(sessionId);
  }

  async send(): Promise<void> {
    const text = this.inputText().trim();
    if (!text || this.chat.isLoading()) return;
    this.inputText.set('');
    this._shouldScroll = true;
    await this.chat.sendMessage(text);
    this._shouldScroll = true;
  }

  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.send();
    }
  }

  /** Navigate to an app path — does NOT close the panel (key UX requirement). */
  navigate(path: string): void {
    this.router.navigateByUrl(path);
  }

  onActionClick(action: AiActionButton): void {
    if (action.actionType === 'navigate' && action.navUrl) {
      this.navigate(action.navUrl);
    }
    // confirm_mutation and execute types can be handled here in the future
    // For now, the confirmation flow is handled by the crew via chat messages
  }

  formatSessionTime(iso: string): string {
    try {
      const d = new Date(iso);
      const now = new Date();
      const diffMs = now.getTime() - d.getTime();
      const mins = Math.floor(diffMs / 60000);
      if (mins < 1) return 'just now';
      if (mins < 60) return `${mins}m ago`;
      const hours = Math.floor(mins / 60);
      if (hours < 24) return `${hours}h ago`;
      const days = Math.floor(hours / 24);
      if (days < 7) return `${days}d ago`;
      return d.toLocaleDateString();
    } catch { return ''; }
  }

  private _scrollToBottom(): void {
    try {
      this.messagesEnd?.nativeElement?.scrollIntoView({ behavior: 'smooth' });
    } catch { /* ignore */ }
  }
}
