import { Component, OnInit, OnDestroy, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { NbCardModule, NbButtonModule, NbBadgeModule, NbIconModule, NbSpinnerModule } from '@nebular/theme';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ManagerService, ManagerMetrics, TenantSummary, HealthCheck } from '../../libs/service/manager.service';
import { KeyValuePipe } from '@angular/common';
import { AppWsService } from '../../libs/service/app-ws.service';
import { LocaleService } from '../../core/locale.service';
import { Subscription } from 'rxjs';

interface ActivityEvent {
  time: string;
  type: string;
  text: string;
  tenant_id?: string;
}

@Component({
  selector: 'manager-overview',
  templateUrl: './manager-overview.html',
  styleUrl: './manager-overview.scss',
  imports: [CommonModule, RouterLink, TranslatePipe, NbCardModule, NbButtonModule, NbBadgeModule, NbIconModule, NbSpinnerModule, KeyValuePipe],
})
export class ManagerOverview implements OnInit, OnDestroy {
  private managerService = inject(ManagerService);
  private appWs         = inject(AppWsService);
  private translate     = inject(TranslateService);
  private localeSvc     = inject(LocaleService);

  metrics  = signal<ManagerMetrics | null>(null);
  tenants  = signal<TenantSummary[]>([]);
  loading  = signal(true);
  error    = signal<string | null>(null);
  activity = signal<ActivityEvent[]>([]);

  // Health check state
  health        = signal<HealthCheck | null>(null);
  healthLoading = signal(false);
  agentPingId   = signal<string | null>(null);
  agentPongAt   = signal<string | null>(null);
  agentRoundTripMs = signal<number | null>(null);
  agentTimedOut = signal(false);
  agentModelsVersion = signal<string | null>(null);
  private _pingStartMs = 0;
  private _pingTimeout: ReturnType<typeof setTimeout> | null = null;

  private wsSub?: Subscription;

  readonly METRIC_CARDS = [
    { key: 'total_tenants',            labelKey: 'manager.overview.metrics.totalTenants',   icon: 'grid-outline' },
    { key: 'total_users',              labelKey: 'manager.overview.metrics.totalLeads',     icon: 'people-outline' },
    { key: 'total_followups_sent',     labelKey: 'manager.overview.metrics.followupsSent',  icon: 'email-outline' },
    { key: 'total_content_jobs',       labelKey: 'manager.overview.metrics.contentJobs',    icon: 'layers-outline' },
    { key: 'total_messages',           labelKey: 'manager.overview.metrics.chatMessages',   icon: 'message-circle-outline' },
    { key: 'total_deals_closed',       labelKey: 'manager.overview.metrics.dealsClosed',    icon: 'award-outline' },
    { key: 'tenants_onboarded',        labelKey: 'manager.overview.metrics.onboarded',      icon: 'checkmark-circle-outline' },
    { key: 'tenants_with_active_plan', labelKey: 'manager.overview.metrics.activePlans',    icon: 'flash-outline' },
  ];

  async ngOnInit() {
    await this.loadData();
    this.subscribeWs();
    this.checkHealth();
  }

  ngOnDestroy() {
    this.wsSub?.unsubscribe();
    if (this._pingTimeout) clearTimeout(this._pingTimeout);
  }

  async loadData() {
    this.loading.set(true);
    this.error.set(null);
    try {
      const res = await this.managerService.getOverview();
      this.metrics.set(res.metrics);
      this.tenants.set(res.tenants);
    } catch (e: any) {
      const msg = e?.name === 'TimeoutError'
        ? this.translate.instant('manager.overview.timedOut')
        : (e?.error?.message || e?.message || this.translate.instant('manager.overview.loadFailed'));
      this.error.set(msg);
    } finally {
      this.loading.set(false);
    }
  }

  private subscribeWs() {
    this.wsSub = this.appWs
      .on('new_user', 'chat_update', 'followup_sent', 'booking_created', 'health_pong')
      .subscribe(msg => {
        // Handle any health pong (match any recent ping, not just the latest)
        if (msg.type === 'health_pong') {
          if (!this.agentPongAt()) {
            if (this._pingTimeout) clearTimeout(this._pingTimeout);
            this.agentTimedOut.set(false);
            this.agentPongAt.set((msg as any).agent_received_at);
            this.agentRoundTripMs.set(Date.now() - this._pingStartMs);
            this.agentModelsVersion.set((msg as any).agent_models_version || null);
          }
          return; // never show health_pong in activity feed
        }

        const event: ActivityEvent = {
          time: this.localeSvc.formatDate(new Date(), { timeStyle: 'short' }),
          type: msg.type,
          text: this.describeEvent(msg),
          tenant_id: (msg as any).tenant_id,
        };
        this.activity.update(a => [event, ...a].slice(0, 50));
      });
  }

  private describeEvent(msg: any): string {
    switch (msg.type) {
      case 'new_user':     return this.translate.instant('manager.overview.evt.newLead', { email: msg.email || '' });
      case 'chat_update':  return this.translate.instant('manager.overview.evt.chatUpdate', { userId: msg.user_id || '' });
      case 'followup_sent': return this.translate.instant('manager.overview.evt.followupSent', { email: msg.email || '' });
      case 'booking_created': return this.translate.instant('manager.overview.evt.bookingCreated');
      default: return msg.type;
    }
  }

  async checkHealth() {
    this.healthLoading.set(true);
    this.agentPongAt.set(null);
    this.agentRoundTripMs.set(null);
    this.agentTimedOut.set(false);
    if (this._pingTimeout) clearTimeout(this._pingTimeout);
    try {
      const h = await this.managerService.getHealth();
      this.health.set(h);

      // Ensure WebSocket is connected before pinging agent (pong arrives via WS).
      await this.appWs.ensureConnected();

      // Ping agent for round-trip test. Retry once if no pong arrives.
      await this._sendPingWithRetry();
    } catch (e: any) {
      this.error.set(this.translate.instant('manager.overview.healthFailed'));
    } finally {
      this.healthLoading.set(false);
    }
  }

  originalOrder = () => 0;

  metricValue(key: string): number {
    const m = this.metrics();
    return m ? (m as any)[key] ?? 0 : 0;
  }

  private async _sendPingWithRetry(attempt = 1): Promise<void> {
    this._pingStartMs = Date.now();
    const ping = await this.managerService.pingAgent();
    this.agentPingId.set(ping.ping_id);

    this._pingTimeout = setTimeout(async () => {
      if (!this.agentPongAt()) {
        if (attempt < 2) {
          await this._sendPingWithRetry(2);
        } else {
          this.agentTimedOut.set(true);
        }
      }
    }, 5_000);
  }

  onboardingPct(t: TenantSummary): number {
    return (t.onboarding as any)?.completion_pct ?? (t.onboarding_complete ? 100 : 0);
  }

  formatDate(iso?: string | null): string {
    if (!iso) return '—';
    return this.localeSvc.formatDate(iso, { dateStyle: 'short' });
  }
}
