import { Component, OnInit, OnDestroy, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { NbCardModule, NbButtonModule, NbBadgeModule, NbIconModule, NbSpinnerModule } from '@nebular/theme';
import { ManagerService, ManagerMetrics, TenantSummary, HealthCheck } from '../../libs/service/manager.service';
import { KeyValuePipe } from '@angular/common';
import { AppWsService } from '../../libs/service/app-ws.service';
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
  imports: [CommonModule, RouterLink, NbCardModule, NbButtonModule, NbBadgeModule, NbIconModule, NbSpinnerModule, KeyValuePipe],
})
export class ManagerOverview implements OnInit, OnDestroy {
  private managerService = inject(ManagerService);
  private appWs         = inject(AppWsService);

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
  private _pingStartMs = 0;
  private _pingTimeout: ReturnType<typeof setTimeout> | null = null;

  private wsSub?: Subscription;

  readonly METRIC_CARDS = [
    { key: 'total_tenants',            label: 'Total Tenants',       icon: 'grid-outline' },
    { key: 'total_users',              label: 'Total Leads',         icon: 'people-outline' },
    { key: 'total_followups_sent',     label: 'Followups Sent',      icon: 'email-outline' },
    { key: 'total_content_jobs',       label: 'Content Jobs',        icon: 'layers-outline' },
    { key: 'total_messages',           label: 'Chat Messages',       icon: 'message-circle-outline' },
    { key: 'total_deals_closed',       label: 'Deals Closed',        icon: 'award-outline' },
    { key: 'tenants_onboarded',        label: 'Onboarded',           icon: 'checkmark-circle-outline' },
    { key: 'tenants_with_active_plan', label: 'Active Plans',        icon: 'flash-outline' },
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
        ? 'Request timed out. Please try again.'
        : (e?.error?.message || e?.message || 'Failed to load manager data.');
      this.error.set(msg);
    } finally {
      this.loading.set(false);
    }
  }

  private subscribeWs() {
    this.wsSub = this.appWs
      .on('new_user', 'chat_update', 'followup_sent', 'booking_created', 'health_pong')
      .subscribe(msg => {
        // Handle health pong
        if (msg.type === 'health_pong' && (msg as any).ping_id === this.agentPingId()) {
          if (this._pingTimeout) clearTimeout(this._pingTimeout);
          this.agentTimedOut.set(false);
          this.agentPongAt.set((msg as any).agent_received_at);
          this.agentRoundTripMs.set(Date.now() - this._pingStartMs);
          return;
        }

        const event: ActivityEvent = {
          time: new Date().toLocaleTimeString(),
          type: msg.type,
          text: this.describeEvent(msg),
          tenant_id: (msg as any).tenant_id,
        };
        this.activity.update(a => [event, ...a].slice(0, 50));
      });
  }

  private describeEvent(msg: any): string {
    switch (msg.type) {
      case 'new_user':     return `New lead: ${msg.email || ''}`;
      case 'chat_update':  return `Chat update for user ${msg.user_id || ''}`;
      case 'followup_sent': return `Followup sent to ${msg.email || ''}`;
      case 'booking_created': return `New booking created`;
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

      // Ping agent for round-trip test
      this._pingStartMs = Date.now();
      const ping = await this.managerService.pingAgent();
      this.agentPingId.set(ping.ping_id);

      // Timeout after 10s if no pong received
      this._pingTimeout = setTimeout(() => {
        if (!this.agentPongAt()) {
          this.agentTimedOut.set(true);
        }
      }, 10_000);
    } catch (e: any) {
      this.error.set('Health check failed');
    } finally {
      this.healthLoading.set(false);
    }
  }

  // Preserve insertion order from API response (keyvalue pipe sorts alphabetically by default)
  originalOrder = () => 0;

  metricValue(key: string): number {
    const m = this.metrics();
    return m ? (m as any)[key] ?? 0 : 0;
  }

  onboardingPct(t: TenantSummary): number {
    return (t.onboarding as any)?.completion_pct ?? (t.onboarding_complete ? 100 : 0);
  }

  formatDate(iso?: string | null): string {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString();
  }
}
