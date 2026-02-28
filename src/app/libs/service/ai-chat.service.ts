import {
  Injectable,
  inject,
  signal,
  computed,
  WritableSignal,
  OnDestroy,
} from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom, Subscription } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { AuthService } from './auth.service';
import { AppWsService } from './app-ws.service';
import { DashboardMetricsService } from './dashboard-metrics.service';
import type { AiChatMessage, AiChatMode, AiChatRequest, AiChatResponse } from '../model/ai-chat';

const API = environment.apiUrl;
const MAX_HISTORY = 5;

const UPGRADE_MESSAGE: AiChatMessage = {
  role: 'assistant',
  content:
    'The AI Employee is available to Module 03 subscribers only. ' +
    'Upgrade your plan in Settings > Plans & Billing to unlock full business intelligence, ' +
    'app navigation, and WhatsApp integration.',
  timestamp: new Date().toISOString(),
};

@Injectable({ providedIn: 'root' })
export class AiChatService implements OnDestroy {
  private http    = inject(HttpClient);
  private auth    = inject(AuthService);
  private appWs   = inject(AppWsService);
  private metrics = inject(DashboardMetricsService);

  readonly messages: WritableSignal<AiChatMessage[]> = signal([]);
  readonly isLoading: WritableSignal<boolean>        = signal(false);
  readonly isBlocked: WritableSignal<boolean>        = signal(false);

  /** Chat mode derived from tenant's onboarding state and active plans. */
  private _mode: WritableSignal<AiChatMode> = signal('ai_employee');
  readonly mode = computed(() => this._mode());

  /** Onboarding state cached from last metrics fetch. */
  private _onboardingData: {
    is_complete: boolean;
    current_stage: number;
    ses_verified: boolean;
    domain_verified: boolean;
    workspace_provider: string;
  } = {
    is_complete: true,
    current_stage: 1,
    ses_verified: false,
    domain_verified: false,
    workspace_provider: '',
  };

  private _wsSub: Subscription | null = null;

  constructor() {
    this._loadMode();
    this._subscribeWs();
  }

  private async _loadMode(): Promise<void> {
    if (!this.auth.isAuthenticated()) return;
    try {
      const m = await this.metrics.getMetrics();
      this._onboardingData = {
        is_complete:        m.onboarding?.is_complete ?? true,
        current_stage:      m.onboarding?.current_stage ?? 1,
        ses_verified:       m.onboarding?.ses_verified ?? false,
        domain_verified:    m.onboarding?.domain_verified ?? false,
        workspace_provider: m.onboarding?.workspace_provider ?? '',
      };

      if (!m.onboarding?.is_complete) {
        this._mode.set('onboarding');
      } else if ((m.active_plans ?? []).some(p => p.module_num === '03')) {
        this._mode.set('ai_employee');
      } else {
        this._mode.set('upgrade');
      }
    } catch {
      // Keep default 'ai_employee' — plan gate enforced by backend anyway
    }
  }

  /** Extract an app-relative path from a full URL string, or return null. */
  private _toNavPath(url: string | null | undefined): string | undefined {
    if (!url) return undefined;
    try {
      return new URL(url).pathname || undefined;
    } catch {
      // If url is already a path (starts with /), use it directly
      return url.startsWith('/') ? url : undefined;
    }
  }

  private _subscribeWs(): void {
    this._wsSub = this.appWs
      .on('ai_employee_response', 'ai_onboard_response')
      .subscribe(msg => {
        const text = msg['message'] as string;
        if (!text) return;

        this.messages.update(list => [
          ...list,
          {
            role: 'assistant',
            content: text,
            timestamp: new Date().toISOString(),
            jobId: msg['job_id'],
            navUrl: this._toNavPath(msg['nav_url'] as string | undefined),
          },
        ]);
        this.isLoading.set(false);

        // If crew flagged injection, surface the warning
        if (msg['injection_detected']) {
          this.messages.update(list => [
            ...list,
            {
              role: 'assistant',
              content:
                '⚠️ Your previous message was flagged as a policy violation.',
              timestamp: new Date().toISOString(),
            },
          ]);
        }
      });
  }

  /** Build last-N exchanges as a compact JSON string for context. */
  private _buildHistory(): string {
    const recent = this.messages().slice(-MAX_HISTORY * 2);
    return JSON.stringify(
      recent.map(m => ({ role: m.role, content: m.content })),
    );
  }

  async sendMessage(text: string): Promise<void> {
    const trimmed = text.trim();
    if (!trimmed || this.isLoading()) return;

    const currentMode = this._mode();

    // Push user message immediately
    this.messages.update(list => [
      ...list,
      { role: 'user', content: trimmed, timestamp: new Date().toISOString() },
    ]);

    // Local upgrade reply — no API call needed
    if (currentMode === 'upgrade') {
      this.messages.update(list => [...list, { ...UPGRADE_MESSAGE, timestamp: new Date().toISOString() }]);
      return;
    }

    this.isLoading.set(true);

    const payload: AiChatRequest = {
      message: trimmed,
      mode: currentMode,
      chat_history: this._buildHistory(),
      source: 'web',
    };

    if (currentMode === 'onboarding') {
      payload.stage             = this._onboardingData.current_stage;
      payload.ses_verified      = this._onboardingData.ses_verified;
      payload.domain_verified   = this._onboardingData.domain_verified;
      payload.workspace_provider = this._onboardingData.workspace_provider;
    }

    try {
      const res = await firstValueFrom(
        this.http.post<AiChatResponse>(
          `${API}/dashboard/ai-chat`,
          payload,
          { headers: this.auth.authHeader() },
        ),
      );

      if (res.upgrade_required) {
        // Backend confirmed no Module 03 — show upgrade prompt immediately
        this.messages.update(list => [...list, { ...UPGRADE_MESSAGE, timestamp: new Date().toISOString() }]);
        this._mode.set('upgrade');
        this.isLoading.set(false);
        return;
      }

      if (res.error === 'injection_detected') {
        this.messages.update(list => [
          ...list,
          {
            role: 'assistant',
            content: res.message ?? 'Your message was flagged as a policy violation.',
            timestamp: new Date().toISOString(),
          },
        ]);
        if ((res.strikes ?? 0) >= 3) {
          this.isBlocked.set(true);
        }
        this.isLoading.set(false);
        return;
      }

      // Queued successfully — response will arrive via WebSocket
    } catch (err: any) {
      this.isLoading.set(false);
      const status = err?.status;

      if (status === 403) {
        this.isBlocked.set(true);
        this.messages.update(list => [
          ...list,
          {
            role: 'assistant',
            content:
              'Your access to the AI Employee has been suspended. Please contact support.',
            timestamp: new Date().toISOString(),
          },
        ]);
        return;
      }

      this.messages.update(list => [
        ...list,
        {
          role: 'assistant',
          content: 'Something went wrong. Please try again in a moment.',
          timestamp: new Date().toISOString(),
        },
      ]);
    }
  }

  /** Refresh mode (call after plan purchase or onboarding completion). */
  refresh(): void {
    this._loadMode();
  }

  ngOnDestroy(): void {
    this._wsSub?.unsubscribe();
  }
}
