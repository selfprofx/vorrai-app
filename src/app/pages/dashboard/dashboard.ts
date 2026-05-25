import { Component, OnInit, OnDestroy, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { NbCardModule, NbButtonModule, NbBadgeModule, NbProgressBarModule,
         NbIconModule, NbInputModule } from '@nebular/theme';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { DashboardMetricsService, DashboardMetrics } from '../../libs/service/dashboard-metrics.service';
import { NotificationService, AppNotification } from '../../libs/service/notification.service';
import { AiChatService } from '../../libs/service/ai-chat.service';
import { GreetingBannerComponent } from '../../components/greeting-banner/greeting-banner';
import { WaitlistActivityComponent } from '../../components/waitlist-activity/waitlist-activity';
import { LabelService } from '../../core/label.service';
import { LocaleService } from '../../core/locale.service';
import { PLAN_TIERS } from '../../libs/model/plan-tier';

@Component({
  selector: 'dashboard',
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
  imports: [
    CommonModule, FormsModule, RouterLink, TranslatePipe,
    NbCardModule, NbButtonModule, NbBadgeModule, NbProgressBarModule, NbIconModule, NbInputModule,
    GreetingBannerComponent,
    WaitlistActivityComponent,
  ],
})
export class Dashboard implements OnInit, OnDestroy {
  private metricsService = inject(DashboardMetricsService);
  private router         = inject(Router);
  private translate      = inject(TranslateService);
  private locale         = inject(LocaleService);
  notificationService    = inject(NotificationService);

  private aiChat = inject(AiChatService);

  /** Reactive label dictionary — flips with the tenant's vertical. */
  protected labels = inject(LabelService).labels;

  metrics   = signal<DashboardMetrics | null>(null);
  loading   = signal(true);
  error     = signal<string | null>(null);
  modulesExpanded = signal(false);

  // ── Computed ──────────────────────────────────────────────────
  readonly onboarding = computed(() => this.metrics()?.onboarding);
  readonly funnel     = computed(() => this.metrics()?.funnel);
  readonly plans      = computed(() => this.metrics()?.active_plans || []);
  readonly today      = computed(() => this.metrics()?.today);
  readonly pending    = computed(() => this.metrics()?.pending);

  readonly recentActivity = computed(() => {
    const fromService = this.notificationService.notifications().slice(0, 10);
    if (fromService.length > 0) return fromService;
    return (this.metrics()?.recent_activity ?? []).map(a => ({
      ...a,
      timestamp: a.created_at,
    })) as AppNotification[];
  });

  readonly hasModule02 = computed(() =>
    this.plans().some(p => p.module_num === '02')
  );

  /** Plan tiers shown in the dashboard "Plans" section — shared with Settings. */
  readonly PLAN_TIERS = PLAN_TIERS;

  /** module_num set of the tenant's currently-active plans. */
  readonly activeModuleNums = computed(() =>
    new Set(this.plans().map(p => p.module_num))
  );

  readonly FUNNEL_STEPS = [
    { key: 'forms_count',    labelKey: 'dashboard.funnel.steps.formsSubmitted',  hintKey: 'dashboard.funnel.hints.formsSubmitted',  icon: 'edit-outline' },
    { key: 'followup_count', labelKey: 'dashboard.funnel.steps.heroEmailsSent',  hintKey: 'dashboard.funnel.hints.heroEmailsSent',  icon: 'navigation-2-outline' },
    { key: 'deals_closed',   labelKey: 'dashboard.funnel.steps.dealsClosed',     hintKey: 'dashboard.funnel.hints.dealsClosed',     icon: 'checkmark-square-outline' },
  ];

  async ngOnInit() {
    await this.loadMetrics();
  }

  ngOnDestroy() {}

  async loadMetrics() {
    this.loading.set(true);
    this.error.set(null);
    try {
      const m = await this.metricsService.getMetrics();
      this.metrics.set(m);
    } catch (e: any) {
      this.error.set(e?.error?.message || this.translate.instant('dashboard.errors.loadFailed'));
    } finally {
      this.loading.set(false);
    }
  }

  funnelCount(key: string): number {
    const f = this.funnel();
    if (!f) return 0;
    return (f as any)[key] ?? 0;
  }

  moduleStatus(num: string): 'active' | 'available' {
    return this.activeModuleNums().has(num) ? 'active' : 'available';
  }

  openChat() { this.aiChat.openPinned(); }

  onActivityClick(n: AppNotification) {
    if (n.link) this.router.navigateByUrl(n.link);
  }

  formatTime(iso: string): string {
    try {
      const d = new Date(iso);
      const now = new Date();
      const diffMs = now.getTime() - d.getTime();
      const mins = Math.floor(diffMs / 60000);
      if (mins < 1) return this.translate.instant('dashboard.time.justNow');
      if (mins < 60) return this.translate.instant('dashboard.time.minutesAgo', { mins });
      const hours = Math.floor(mins / 60);
      if (hours < 24) return this.translate.instant('dashboard.time.hoursAgo', { hours });
      return this.locale.formatDate(d);
    } catch { return iso; }
  }

  iconForType(type: string): string {
    switch (type) {
      case 'new_user': return 'person-add-outline';
      case 'chat_update': return 'message-circle-outline';
      case 'content_job_done': return 'layers-outline';
      case 'followup_sent': return 'email-outline';
      case 'booking_created': return 'calendar-outline';
      case 'sequence_pending': return 'alert-circle-outline';
      default: return 'bell-outline';
    }
  }

}
