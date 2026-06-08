import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnDestroy,
  Output,
  ViewChild,
  signal,
} from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { environment } from '../../environments/environment';

declare global {
  interface Window {
    turnstile?: {
      render: (
        host: HTMLElement,
        opts: {
          sitekey: string;
          callback: (token: string) => void;
          'expired-callback'?: () => void;
          'error-callback'?: () => void;
          theme?: 'light' | 'dark' | 'auto';
          size?: 'normal' | 'compact';
          action?: string;
        },
      ) => string;
      remove: (widgetId: string) => void;
      reset: (widgetId?: string) => void;
    };
  }
}

@Component({
  selector: 'app-turnstile',
  standalone: true,
  imports: [TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div #host class="turnstile-host"></div>
    @if (!ready()) {
      <div class="ts-verifying">
        <span class="ts-spinner" aria-hidden="true"></span>
        <span>{{ 'auth.captcha.verifying' | translate }}</span>
      </div>
    }
  `,
  styles: [`
    :host { display: block; margin: 8px 0 16px; min-height: 65px; }
    .turnstile-host { display: flex; justify-content: center; }
    .ts-verifying {
      display: flex; align-items: center; justify-content: center;
      gap: 8px; margin-top: 6px; font-size: 0.85rem; color: #546E7A;
    }
    .ts-spinner {
      display: inline-block; width: 16px; height: 16px; border-radius: 50%;
      border: 2px solid #004B3C; border-top-color: transparent;
      animation: ts-spin 0.7s linear infinite;
    }
    @keyframes ts-spin { to { transform: rotate(360deg); } }
  `],
})
export class TurnstileComponent implements AfterViewInit, OnDestroy {
  @ViewChild('host', { static: true }) hostRef!: ElementRef<HTMLDivElement>;

  /** Logical action this widget gates — must match a server-side _VALID_ACTIONS entry. */
  @Input() action = 'login';

  /** Emits the Turnstile response token whenever the user (re-)solves the challenge. */
  @Output() token = new EventEmitter<string>();

  /** Emits null when the token expires or the widget errors, so parents can disable submit. */
  @Output() expired = new EventEmitter<null>();

  /** True once the challenge is solved; drives the "Verifying security…" label. */
  readonly ready = signal(false);

  private widgetId: string | null = null;
  private pollHandle: number | null = null;

  ngAfterViewInit(): void {
    const siteKey = environment.turnstileSiteKey;
    if (!siteKey) {
      // Build-time env var not injected — fail closed. Submit button stays
      // disabled because parent components gate it on a non-empty token.
      console.warn('[Turnstile] TURNSTILE_SITE_KEY is not set; widget skipped.');
      return;
    }
    this.waitForTurnstile(siteKey);
  }

  ngOnDestroy(): void {
    if (this.pollHandle !== null) window.clearInterval(this.pollHandle);
    if (this.widgetId && window.turnstile) {
      try { window.turnstile.remove(this.widgetId); } catch { /* widget already gone */ }
    }
  }

  reset(): void {
    this.ready.set(false);
    if (this.widgetId && window.turnstile) {
      try { window.turnstile.reset(this.widgetId); } catch { /* noop */ }
    }
  }

  private waitForTurnstile(siteKey: string, attempts = 0): void {
    if (window.turnstile) {
      this.render(siteKey);
      return;
    }
    if (attempts > 60) {
      // ~6 s — the Turnstile script didn't load. Fail closed.
      console.warn('[Turnstile] api.js never finished loading.');
      return;
    }
    this.pollHandle = window.setTimeout(() => this.waitForTurnstile(siteKey, attempts + 1), 100);
  }

  private render(siteKey: string): void {
    this.widgetId = window.turnstile!.render(this.hostRef.nativeElement, {
      sitekey: siteKey,
      action: this.action,
      callback: (token: string) => { this.ready.set(true); this.token.emit(token); },
      'expired-callback': () => { this.ready.set(false); this.expired.emit(null); },
      'error-callback': () => { this.ready.set(false); this.expired.emit(null); },
    });
  }
}
