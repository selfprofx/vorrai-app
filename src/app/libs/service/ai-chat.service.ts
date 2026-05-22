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
import { environment } from '../../../environments/environment';
import { AuthService } from './auth.service';
import { AppWsService } from './app-ws.service';
import { DashboardMetricsService } from './dashboard-metrics.service';
import type {
  AiChatMessage,
  AiChatMode,
  AiChatRequest,
  AiChatResponse,
  AiChatSession,
  AiActionButton,
} from '../model/ai-chat';

const API = environment.apiUrl;
const PIN_STORAGE_KEY = 'vendia-ai-panel-pinned';

const UPGRADE_MESSAGE: AiChatMessage = {
  role: 'assistant',
  content:
    'The AI Receptionist is available to Module 03 subscribers only. ' +
    'Upgrade your plan in Settings > Plans & Billing to unlock full business intelligence, ' +
    'app navigation, and WhatsApp integration.',
  timestamp: new Date().toISOString(),
};

const MODE_LABELS: Record<string, string> = {
  onboarding: 'Setup Guide',
  ai_employee: 'AI Receptionist',
  upgrade: 'AI Receptionist',
};

@Injectable({ providedIn: 'root' })
export class AiChatService implements OnDestroy {
  private http    = inject(HttpClient);
  private auth    = inject(AuthService);
  private appWs   = inject(AppWsService);
  private metrics = inject(DashboardMetricsService);

  // ── Core state ────────────────────────────────────────────────
  readonly messages: WritableSignal<AiChatMessage[]> = signal([]);
  readonly isLoading: WritableSignal<boolean>        = signal(false);
  readonly isBlocked: WritableSignal<boolean>        = signal(false);
  readonly isOpen: WritableSignal<boolean>           = signal(false);

  // ── Session state ─────────────────────────────────────────────
  readonly sessions: WritableSignal<AiChatSession[]>        = signal([]);
  readonly activeSessionId: WritableSignal<string | null>   = signal(null);
  readonly sessionsLoading: WritableSignal<boolean>         = signal(false);

  readonly activeSession = computed(() => {
    const sid = this.activeSessionId();
    return sid ? this.sessions().find(s => s.session_id === sid) ?? null : null;
  });

  // ── Pin state ─────────────────────────────────────────────────
  readonly isPinned: WritableSignal<boolean> = signal(
    typeof localStorage !== 'undefined'
      ? localStorage.getItem(PIN_STORAGE_KEY) === 'true'
      : false,
  );

  // ── Mode ──────────────────────────────────────────────────────
  private _mode: WritableSignal<AiChatMode> = signal('ai_employee');
  readonly mode = computed(() => this._mode());
  readonly modeLabel = computed(() => MODE_LABELS[this._mode()] ?? 'Vorrai AI');

  private _onboardingData = {
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

  // ── Panel controls ────────────────────────────────────────────

  toggle(): void {
    const next = !this.isOpen();
    this.isOpen.set(next);
    if (next && this.sessions().length === 0) {
      this.loadSessions();
    }
  }

  togglePin(): void {
    const next = !this.isPinned();
    this.isPinned.set(next);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(PIN_STORAGE_KEY, String(next));
    }
  }

  // ── Session management ────────────────────────────────────────

  async loadSessions(): Promise<void> {
    this.sessionsLoading.set(true);
    try {
      const res = await firstValueFrom(
        this.http.get<{ sessions: AiChatSession[]; next_key: string | null }>(
          `${API}/dashboard/ai-chat/sessions`,
        ),
      );
      this.sessions.set(res.sessions);
    } catch {
      // Silent — sessions list is best-effort
    } finally {
      this.sessionsLoading.set(false);
    }
  }

  async createSession(mode?: AiChatMode): Promise<string | null> {
    try {
      const res = await firstValueFrom(
        this.http.post<{ session_id: string; created_at: string }>(
          `${API}/dashboard/ai-chat/sessions`,
          { mode: mode ?? this._mode() },
        ),
      );
      // Prepend new session to list
      this.sessions.update(list => [
        {
          session_id: res.session_id,
          title: null,
          mode: mode ?? this._mode(),
          created_at: res.created_at,
          updated_at: res.created_at,
          message_count: 0,
          is_archived: false,
        },
        ...list,
      ]);
      return res.session_id;
    } catch {
      return null;
    }
  }

  async switchSession(sessionId: string): Promise<void> {
    this.activeSessionId.set(sessionId);
    this.messages.set([]);
    this.isLoading.set(false);

    try {
      const res = await firstValueFrom(
        this.http.get<{ messages: any[]; next_key: string | null }>(
          `${API}/dashboard/ai-chat/sessions/${sessionId}/messages`,
        ),
      );
      this.messages.set(
        res.messages.map(m => ({
          role: m.role,
          content: m.content,
          timestamp: m.timestamp,
          jobId: m.job_id,
          navUrl: this._toNavPath(m.nav_url),
          actions: m.actions?.map((a: any) => ({
            label: a.label,
            navUrl: this._toNavPath(a.nav_url) ?? a.nav_url,
            icon: a.icon,
            actionType: a.action_type,
            actionPayload: a.action_payload,
          })),
        })),
      );
    } catch {
      // Will show empty state
    }
  }

  async startNewChat(): Promise<void> {
    const sid = await this.createSession();
    if (sid) {
      this.activeSessionId.set(sid);
      this.messages.set([]);
    }
  }

  async renameSession(sessionId: string, title: string): Promise<void> {
    try {
      await firstValueFrom(
        this.http.put(`${API}/dashboard/ai-chat/sessions/${sessionId}`, { title }),
      );
      this.sessions.update(list =>
        list.map(s => s.session_id === sessionId ? { ...s, title } : s),
      );
    } catch { /* silent */ }
  }

  async deleteSession(sessionId: string): Promise<void> {
    try {
      await firstValueFrom(
        this.http.delete(`${API}/dashboard/ai-chat/sessions/${sessionId}`),
      );
      this.sessions.update(list => list.filter(s => s.session_id !== sessionId));
      if (this.activeSessionId() === sessionId) {
        this.activeSessionId.set(null);
        this.messages.set([]);
      }
    } catch { /* silent */ }
  }

  // ── Send message ──────────────────────────────────────────────

  async sendMessage(text: string): Promise<void> {
    const trimmed = text.trim();
    if (!trimmed || this.isLoading()) return;

    const currentMode = this._mode();

    // Push user message immediately
    this.messages.update(list => [
      ...list,
      { role: 'user', content: trimmed, timestamp: new Date().toISOString() },
    ]);

    // Local upgrade reply — no API call
    if (currentMode === 'upgrade') {
      this.messages.update(list => [
        ...list,
        { ...UPGRADE_MESSAGE, timestamp: new Date().toISOString() },
      ]);
      return;
    }

    this.isLoading.set(true);

    // Auto-create session if none active
    let sessionId = this.activeSessionId();
    if (!sessionId) {
      sessionId = await this.createSession();
      if (sessionId) this.activeSessionId.set(sessionId);
    }

    const payload: AiChatRequest = {
      message: trimmed,
      mode: currentMode,
      session_id: sessionId ?? undefined,
      source: 'web',
    };

    if (currentMode === 'onboarding') {
      payload.stage = this._onboardingData.current_stage;
      payload.ses_verified = this._onboardingData.ses_verified;
      payload.domain_verified = this._onboardingData.domain_verified;
      payload.workspace_provider = this._onboardingData.workspace_provider;
    }

    try {
      const res = await firstValueFrom(
        this.http.post<AiChatResponse>(`${API}/dashboard/ai-chat`, payload),
      );

      // Update session_id if auto-created by backend
      if (res.session_id && !this.activeSessionId()) {
        this.activeSessionId.set(res.session_id);
      }

      if (res.upgrade_required) {
        this.messages.update(list => [
          ...list,
          { ...UPGRADE_MESSAGE, timestamp: new Date().toISOString() },
        ]);
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
        if ((res.strikes ?? 0) >= 3) this.isBlocked.set(true);
        this.isLoading.set(false);
        return;
      }

      // Queued successfully — response arrives via WebSocket
    } catch (err: any) {
      this.isLoading.set(false);
      if (err?.status === 403) {
        this.isBlocked.set(true);
        this.messages.update(list => [
          ...list,
          {
            role: 'assistant',
            content: 'Your access to the AI Receptionist has been suspended. Please contact support.',
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

  // ── WebSocket subscription ────────────────────────────────────

  private _subscribeWs(): void {
    this._wsSub = this.appWs
      .on('ai_employee_response', 'ai_onboard_response')
      .subscribe(msg => {
        const text = msg['message'] as string;
        if (!text) return;

        const msgSessionId = msg['session_id'] as string | undefined;
        const actions = (msg['actions'] as any[] | undefined)?.map(a => ({
          label: a.label,
          navUrl: this._toNavPath(a.nav_url) ?? a.nav_url,
          icon: a.icon,
          actionType: a.action_type,
          actionPayload: a.action_payload,
        }));

        const newMsg: AiChatMessage = {
          role: 'assistant',
          content: text,
          timestamp: new Date().toISOString(),
          jobId: msg['job_id'] as string | undefined,
          navUrl: this._toNavPath(msg['nav_url'] as string | undefined),
          actions,
        };

        // Update session title if received
        const sessionTitle = msg['session_title'] as string | undefined;
        if (sessionTitle && msgSessionId) {
          this.sessions.update(list =>
            list.map(s =>
              s.session_id === msgSessionId ? { ...s, title: sessionTitle } : s,
            ),
          );
        }

        // Bump session updated_at in the list
        if (msgSessionId) {
          this.sessions.update(list =>
            list.map(s =>
              s.session_id === msgSessionId
                ? { ...s, updated_at: new Date().toISOString(), message_count: s.message_count + 1 }
                : s,
            ),
          );
        }

        // Only add to visible messages if it's for the active session
        if (!msgSessionId || msgSessionId === this.activeSessionId()) {
          this.messages.update(list => [...list, newMsg]);
          this.isLoading.set(false);
        }

        // If crew flagged injection
        if (msg['injection_detected']) {
          this.messages.update(list => [
            ...list,
            {
              role: 'assistant',
              content: 'Your previous message was flagged as a policy violation.',
              timestamp: new Date().toISOString(),
            },
          ]);
        }
      });
  }

  // ── Mode detection ────────────────────────────────────────────

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
      // Keep default
    }
  }

  private _toNavPath(url: string | null | undefined): string | undefined {
    if (!url) return undefined;
    try {
      return new URL(url).pathname || undefined;
    } catch {
      return url.startsWith('/') ? url : undefined;
    }
  }

  refresh(): void {
    this._loadMode();
  }

  ngOnDestroy(): void {
    this._wsSub?.unsubscribe();
  }
}
