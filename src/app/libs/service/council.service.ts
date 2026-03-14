import { Injectable, inject, signal, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom, Subscription } from 'rxjs';
import type {
  CouncilSession,
  CouncilExpert,
  CouncilReport,
} from '../model/council';
import { AuthService } from './auth.service';
import { AppWsService } from './app-ws.service';
import { environment } from '../../../environments/environment';

const API = environment.apiUrl;

@Injectable({ providedIn: 'root' })
export class CouncilService implements OnDestroy {
  private http = inject(HttpClient);
  private auth = inject(AuthService);
  private appWs = inject(AppWsService);

  // ── State ──────────────────────────────────────────────────────────────────
  sessions        = signal<CouncilSession[]>([]);
  selectedSession = signal<CouncilSession | null>(null);
  experts         = signal<CouncilExpert[]>([]);
  loading         = signal(false);
  error           = signal<string | null>(null);
  reportLoading   = signal(false);
  report          = signal<CouncilReport | null>(null);
  cursor          = signal<string | null>(null);

  private wsSub: Subscription | null = null;

  constructor() {
    // Subscribe to council_update WebSocket events
    this.wsSub = this.appWs.on('council_update').subscribe((msg) => {
      const sessionId = msg['session_id'];
      const status = msg['status'];
      if (!sessionId || !status) return;

      // Update session in list
      this.sessions.update((list) =>
        list.map((s) =>
          s.session_id === sessionId ? { ...s, status } : s
        )
      );

      // Update selected session if it matches
      const sel = this.selectedSession();
      if (sel && sel.session_id === sessionId) {
        this.selectedSession.set({ ...sel, status });
      }
    });
  }

  ngOnDestroy(): void {
    this.wsSub?.unsubscribe();
  }

  // ── Sessions ───────────────────────────────────────────────────────────────

  async loadSessions(reset = false): Promise<void> {
    await this.auth.ready;
    if (!this.auth.isAuthenticated()) return;
    this.loading.set(true);
    this.error.set(null);
    try {
      const cursorParam = !reset && this.cursor() ? `&cursor=${encodeURIComponent(this.cursor()!)}` : '';
      const res = await firstValueFrom(
        this.http.get<{ items: CouncilSession[]; cursor?: string }>(
          `${API}/dashboard/council/sessions?limit=20${cursorParam}`
        )
      );
      if (reset) {
        this.sessions.set(res.items ?? []);
      } else {
        this.sessions.update((prev) => [...prev, ...(res.items ?? [])]);
      }
      this.cursor.set(res.cursor ?? null);
    } catch (e: any) {
      this.error.set(e?.error?.message ?? 'Failed to load sessions');
    } finally {
      this.loading.set(false);
    }
  }

  async getSession(sessionId: string): Promise<CouncilSession | null> {
    try {
      const session = await firstValueFrom(
        this.http.get<CouncilSession>(
          `${API}/dashboard/council/sessions/${sessionId}`
        )
      );
      this.selectedSession.set(session);
      return session;
    } catch (e: any) {
      this.error.set(e?.error?.message ?? 'Failed to load session');
      return null;
    }
  }

  async createSession(body: {
    question: string;
    selected_experts?: string[];
    selected_crews?: string[];
  }): Promise<CouncilSession | null> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const session = await firstValueFrom(
        this.http.post<CouncilSession>(
          `${API}/dashboard/council/sessions`,
          body
        )
      );
      this.sessions.update((list) => [session, ...list]);
      return session;
    } catch (e: any) {
      this.error.set(e?.error?.message ?? 'Failed to create session');
      return null;
    } finally {
      this.loading.set(false);
    }
  }

  // ── Report ─────────────────────────────────────────────────────────────────

  async getReport(sessionId: string): Promise<CouncilReport | null> {
    this.reportLoading.set(true);
    try {
      const r = await firstValueFrom(
        this.http.get<CouncilReport>(
          `${API}/dashboard/council/sessions/${sessionId}/report`
        )
      );
      this.report.set(r);
      return r;
    } catch (e: any) {
      this.error.set(e?.error?.message ?? 'Failed to load report');
      return null;
    } finally {
      this.reportLoading.set(false);
    }
  }

  // ── Experts ────────────────────────────────────────────────────────────────

  async loadExperts(domain?: string): Promise<void> {
    await this.auth.ready;
    if (!this.auth.isAuthenticated()) return;
    try {
      const params = domain ? `?domain=${encodeURIComponent(domain)}` : '';
      const res = await firstValueFrom(
        this.http.get<{ items: CouncilExpert[] }>(
          `${API}/dashboard/council/experts${params}`
        )
      );
      this.experts.set(res.items ?? []);
    } catch (e: any) {
      this.error.set(e?.error?.message ?? 'Failed to load experts');
    }
  }
}
