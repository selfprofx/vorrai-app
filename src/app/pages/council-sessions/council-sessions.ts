import {
  Component, OnInit, signal, computed, inject, effect,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import {
  NbCardModule, NbButtonModule, NbIconModule,
  NbSpinnerModule, NbAlertModule, NbToastrService,
  NbBadgeModule,
} from '@nebular/theme';
import { CouncilService } from '../../libs/service/council.service';
import type { CouncilSession, CouncilReport } from '../../libs/model/council';

const STATUS_MAP: Record<string, { label: string; css: string }> = {
  routing:    { label: 'Routing',    css: 'status-info' },
  processing: { label: 'Processing', css: 'status-info' },
  qa:         { label: 'QA',         css: 'status-warning' },
  completed:  { label: 'Completed',  css: 'status-success' },
  failed:     { label: 'Failed',     css: 'status-danger' },
};

@Component({
  selector: 'app-council-sessions',
  templateUrl: './council-sessions.html',
  styleUrl: './council-sessions.scss',
  imports: [
    CommonModule, RouterLink,
    NbCardModule, NbButtonModule, NbIconModule,
    NbSpinnerModule, NbAlertModule, NbBadgeModule,
  ],
})
export class CouncilSessions implements OnInit {
  private svc    = inject(CouncilService);
  private toastr = inject(NbToastrService);

  // ── Service state ─────────────────────────────────────────────────────────
  readonly sessions     = computed(() => this.svc.sessions());
  readonly loading      = computed(() => this.svc.loading());
  readonly error        = computed(() => this.svc.error());
  readonly hasMore      = computed(() => !!this.svc.cursor());
  readonly reportLoading = computed(() => this.svc.reportLoading());

  // ── UI state ──────────────────────────────────────────────────────────────
  selectedSession = signal<CouncilSession | null>(null);
  report          = signal<CouncilReport | null>(null);

  // Auto-load report when selected session is completed
  private reportEffect = effect(() => {
    const session = this.selectedSession();
    if (session?.status === 'completed') {
      this.loadReport(session.session_id);
    } else {
      this.report.set(null);
    }
  });

  // ── Lifecycle ─────────────────────────────────────────────────────────────
  async ngOnInit() {
    await this.svc.loadSessions(true);
  }

  // ── Selection ─────────────────────────────────────────────────────────────
  async selectSession(s: CouncilSession) {
    // Load full session details
    const full = await this.svc.getSession(s.session_id);
    if (full) {
      this.selectedSession.set(full);
    }
  }

  // ── Pagination ────────────────────────────────────────────────────────────
  async loadMore() {
    await this.svc.loadSessions(false);
  }

  // ── Report ────────────────────────────────────────────────────────────────
  private async loadReport(sessionId: string) {
    const r = await this.svc.getReport(sessionId);
    this.report.set(r);
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  statusLabel(status: string): string {
    return STATUS_MAP[status]?.label ?? status;
  }

  statusCss(status: string): string {
    return STATUS_MAP[status]?.css ?? 'status-basic';
  }

  truncateQuestion(q: string, max = 80): string {
    return q.length > max ? q.slice(0, max) + '...' : q;
  }

  formatTime(ms?: number | null): string {
    if (!ms) return '--';
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  }

  trackBy(_: number, item: CouncilSession) { return item.session_id; }
}
