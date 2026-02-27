import { Component, OnInit, OnDestroy, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { NbCardModule, NbButtonModule, NbBadgeModule, NbIconModule, NbSpinnerModule } from '@nebular/theme';
import { ManagerService, ManagerMetrics, TenantSummary } from '../../libs/service/manager.service';
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
  imports: [CommonModule, RouterLink, NbCardModule, NbButtonModule, NbBadgeModule, NbIconModule, NbSpinnerModule],
})
export class ManagerOverview implements OnInit, OnDestroy {
  private managerService = inject(ManagerService);
  private appWs         = inject(AppWsService);

  metrics  = signal<ManagerMetrics | null>(null);
  tenants  = signal<TenantSummary[]>([]);
  loading  = signal(true);
  error    = signal<string | null>(null);
  activity = signal<ActivityEvent[]>([]);

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
  }

  ngOnDestroy() {
    this.wsSub?.unsubscribe();
  }

  async loadData() {
    this.loading.set(true);
    this.error.set(null);
    try {
      const [metricsRes, tenantsRes] = await Promise.all([
        this.managerService.getMetrics(),
        this.managerService.getTenants(),
      ]);
      this.metrics.set(metricsRes);
      this.tenants.set(tenantsRes.items);
    } catch (e: any) {
      this.error.set(e?.error?.message || 'Failed to load manager data.');
    } finally {
      this.loading.set(false);
    }
  }

  private subscribeWs() {
    this.wsSub = this.appWs
      .on('new_user', 'chat_update', 'followup_sent', 'booking_created')
      .subscribe(msg => {
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
