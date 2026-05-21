import { Component, OnInit, OnDestroy, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { NbCardModule, NbButtonModule, NbBadgeModule, NbProgressBarModule,
         NbToastrService, NbIconModule, NbInputModule } from '@nebular/theme';
import { DashboardMetricsService, DashboardMetrics } from '../../libs/service/dashboard-metrics.service';
import { NotificationService, AppNotification } from '../../libs/service/notification.service';
import { AuthService } from '../../libs/service/auth.service';
import { AiChatService } from '../../libs/service/ai-chat.service';

@Component({
  selector: 'dashboard',
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
  imports: [
    CommonModule, FormsModule, RouterLink,
    NbCardModule, NbButtonModule, NbBadgeModule, NbProgressBarModule, NbIconModule, NbInputModule,
  ],
})
export class Dashboard implements OnInit, OnDestroy {
  private metricsService = inject(DashboardMetricsService);
  private toastr         = inject(NbToastrService);
  private router         = inject(Router);
  private auth           = inject(AuthService);
  notificationService    = inject(NotificationService);

  private aiChat = inject(AiChatService);

  metrics   = signal<DashboardMetrics | null>(null);
  loading   = signal(true);
  error     = signal<string | null>(null);
  modulesExpanded = signal(false);

  // ── Computed ──────────────────────────────────────────────────
  readonly onboarding = computed(() => this.metrics()?.onboarding);
  readonly funnel     = computed(() => this.metrics()?.funnel);
  readonly plans      = computed(() => this.metrics()?.active_plans || []);
  readonly sesVerified = computed(() => this.metrics()?.ses_verified || false);
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

  readonly greeting = computed(() => {
    const hour = new Date().getHours();
    const name = this.auth.displayName()?.split(' ')[0] || 'there';
    if (hour < 12) return `Good morning, ${name}.`;
    if (hour < 18) return `Good afternoon, ${name}.`;
    return `Good evening, ${name}.`;
  });

  readonly hasModule02 = computed(() =>
    this.plans().some(p => p.module_num === '02')
  );

  readonly MODULES = [
    { num: '01', title: 'Vendia Voice Engine',   subtitle: 'The Core AI Clone',      module_num: '01',
      color: '#004B3C', desc: 'Your AI sales clone. Deployed 24/7 across every DM and comment thread.',
      features: ['SPIN Selling flows built-in', 'Personalized follow-up emails'], slug: 'vendia-voice-engine' },
    { num: '02', title: 'Hero Content Engine',   subtitle: 'Omni-Channel Presence',  module_num: '02',
      color: '#004B3C', desc: 'Omni-channel omnipresence. Transform voice notes into high-converting content.',
      features: ['Ad Compliance Intelligence included'], slug: 'hero-content' },
    { num: '03', title: 'AI Employee',           subtitle: 'Business Operator',       module_num: '03',
      color: '#004B3C', desc: 'Your flawless operator. Manages calendar, drafts replies, flags hot leads.',
      features: ['Never sleeps. Never misses a follow-up.'],
      comingSoon: true, interestSlug: 'ai-employee', interestName: 'AI Employee' },
    { num: '04', title: 'Client Ascension System', subtitle: 'Post-Sale Automation', module_num: '04',
      color: '#004B3C', desc: 'Automated LTV expansion. Turn one-time buyers into long-term retainer clients.',
      features: ['Turns one-time buyers into retainer clients'],
      comingSoon: true, interestSlug: 'client-ascension-system', interestName: 'Client Ascension System' },
  ];

  readonly FUNNEL_STEPS = [
    { key: 'forms_count',    label: 'Forms Submitted',  icon: 'edit-outline',  hint: 'Leads who filled and verified your landing page form' },
    { key: 'followup_count', label: 'Hero Emails Sent', icon: 'navigation-2-outline', hint: 'Personalised follow-up emails sent by the Voice Engine' },
    { key: 'deals_closed',   label: 'Deals Closed',     icon: 'checkmark-square-outline', hint: 'Offer tokens that were paid (status = used)' },
  ];

  // ── Feature interest modal ─────────────────────────────────────
  interestModal = signal<{ slug: string; name: string } | null>(null);
  interestMsg   = signal('');

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
      this.error.set(e?.error?.message || 'Could not load dashboard data.');
    } finally {
      this.loading.set(false);
    }
  }

  funnelCount(key: string): number {
    const f = this.funnel();
    if (!f) return 0;
    return (f as any)[key] ?? 0;
  }

  moduleStatus(mod: typeof this.MODULES[0]): 'active' | 'upgrade' | 'coming-soon' {
    if (mod.comingSoon) return 'coming-soon';
    if (this.plans().some(p => p.module_num === mod.module_num)) return 'active';
    return 'upgrade';
  }

  openInterest(slug: string, name: string) {
    this.interestModal.set({ slug, name });
    this.interestMsg.set('');
  }

  closeInterest() { this.interestModal.set(null); }

  submitInterest() {
    const m = this.interestModal();
    if (!m) return;
    this.toastr.success(`You're on the waitlist for ${m.name}!`, 'Registered');
    this.interestModal.set(null);
  }

  toggleChat() { this.aiChat.toggle(); }

  onActivityClick(n: AppNotification) {
    if (n.link) this.router.navigateByUrl(n.link);
  }

  formatTime(iso: string): string {
    try {
      const d = new Date(iso);
      const now = new Date();
      const diffMs = now.getTime() - d.getTime();
      const mins = Math.floor(diffMs / 60000);
      if (mins < 1) return 'just now';
      if (mins < 60) return `${mins}m ago`;
      const hours = Math.floor(mins / 60);
      if (hours < 24) return `${hours}h ago`;
      return d.toLocaleDateString();
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
