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
import { RouterModule } from '@angular/router';
import { AiLogoSvgComponent } from './ai-logo-svg';
import { AiChatService } from '../../libs/service/ai-chat.service';
import { AuthService } from '../../libs/service/auth.service';

const MODE_LABELS: Record<string, string> = {
  onboarding:   'Setup Guide',
  ai_employee:  'AI Employee',
  upgrade:      'AI Employee',
};

@Component({
  selector: 'app-ai-assistant',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, AiLogoSvgComponent],
  templateUrl: './ai-assistant.html',
  styleUrl: './ai-assistant.scss',
})
export class AiAssistantComponent implements OnInit, AfterViewChecked {
  private auth    = inject(AuthService);
  readonly chat   = inject(AiChatService);

  @ViewChild('messagesEnd') private messagesEnd!: ElementRef<HTMLDivElement>;

  readonly isOpen    = signal(false);
  readonly inputText = signal('');

  readonly visible = computed(() => this.auth.isAuthenticated());
  readonly modeLabel = computed(() => MODE_LABELS[this.chat.mode()] ?? 'Vendia AI');

  private _shouldScroll = false;

  ngOnInit(): void {}

  ngAfterViewChecked(): void {
    if (this._shouldScroll) {
      this._scrollToBottom();
      this._shouldScroll = false;
    }
  }

  toggle(): void {
    this.isOpen.update(v => !v);
    if (this.isOpen()) {
      this._shouldScroll = true;
    }
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

  private _scrollToBottom(): void {
    try {
      this.messagesEnd?.nativeElement?.scrollIntoView({ behavior: 'smooth' });
    } catch { /* ignore */ }
  }
}
