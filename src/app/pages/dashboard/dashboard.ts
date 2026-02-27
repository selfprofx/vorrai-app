import { Component, OnInit, OnDestroy, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { NbCardModule, NbButtonModule, NbBadgeModule, NbProgressBarModule,
         NbToastrService, NbIconModule } from '@nebular/theme';
import { DashboardMetricsService, DashboardMetrics } from '../../libs/service/dashboard-metrics.service';
import { environment } from '../../../../environments/environment';

const WSS_URL = environment.wssUrl || '';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
}

@Component({
  selector: 'dashboard',
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
  imports: [
    CommonModule, RouterLink,
    NbCardModule, NbButtonModule, NbBadgeModule, NbProgressBarModule, NbIconModule,
  ],
})
export class Dashboard implements OnInit, OnDestroy {
  private metricsService = inject(DashboardMetricsService);
  private toastr         = inject(NbToastrService);

  metrics   = signal<DashboardMetrics | null>(null);
  loading   = signal(true);
  error     = signal<string | null>(null);

  // ── Chat ──────────────────────────────────────────────────────
  chatOpen     = signal(false);
  chatMessages = signal<ChatMessage[]>([]);
  chatInput    = signal('');
  chatSending  = signal(false);
  private ws: WebSocket | null = null;

  // ── Computed ──────────────────────────────────────────────────
  readonly onboarding = computed(() => this.metrics()?.onboarding);
  readonly funnel     = computed(() => this.metrics()?.funnel);
  readonly plans      = computed(() => this.metrics()?.active_plans || []);
  readonly sesVerified = computed(() => this.metrics()?.ses_verified || false);

  readonly hasModule02 = computed(() =>
    this.plans().some(p => p.module_num === '02')
  );

  readonly MODULES = [
    { num: '01', title: 'Voice Engine',          subtitle: 'Core AI Clone',          module_num: '01',
      color: '#FFD700', desc: 'AI sales clone deployed 24/7 across every DM and inbox.', slug: 'vendia-voice-engine' },
    { num: '02', title: 'Hero Content Engine',   subtitle: 'Omni-Channel Presence',  module_num: '02',
      color: '#F9E79F', desc: 'Transforms ideas into LinkedIn posts, carousels, video scripts.', slug: 'hero-content' },
    { num: '03', title: 'AI Employee',           subtitle: 'Built on OpenClaw',       module_num: '03',
      color: '#00FFFF', desc: 'Runs your entire business from your smartphone. Coming soon.',
      comingSoon: true, interestSlug: 'ai-employee', interestName: 'AI Employee' },
    { num: '04', title: 'Client Ascension',      subtitle: 'Post-Sale Automation',   module_num: '04',
      color: '#FFD700', desc: 'Turns buyers into retainer clients. Coming soon.',
      comingSoon: true, interestSlug: 'client-ascension-system', interestName: 'Client Ascension System' },
  ];

  readonly FUNNEL_STEPS = [
    { key: 'forms_count',    label: 'Forms Submitted',  icon: '📋', hint: 'Leads who filled and verified your landing page form' },
    { key: 'followup_count', label: 'Hero Emails Sent', icon: '✉',  hint: 'Personalised follow-up emails sent by the Voice Engine' },
    { key: 'deals_closed',   label: 'Deals Closed',     icon: '🏆', hint: 'Offer tokens that were paid (status = used)' },
  ];

  // ── Feature interest modal ─────────────────────────────────────
  interestModal = signal<{ slug: string; name: string } | null>(null);
  interestMsg   = signal('');

  async ngOnInit() {
    await this.loadMetrics();
    this.connectWebSocket();
    this.addMessage('assistant', `Welcome back! You have ${this.funnel()?.forms_count || 0} leads in the pipeline. How can I help you today?`);
  }

  ngOnDestroy() {
    this.ws?.close();
  }

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

  // ── WebSocket ─────────────────────────────────────────────────
  private connectWebSocket() {
    if (!WSS_URL) return;
    this.ws = new WebSocket(WSS_URL);
    this.ws.onmessage = (evt) => {
      try {
        const data = JSON.parse(evt.data);
        if (data.type === 'message' || data.text) {
          this.addMessage('assistant', data.text || data.message || '');
          this.chatSending.set(false);
        }
      } catch { /* ignore */ }
    };
    this.ws.onclose = () => setTimeout(() => this.connectWebSocket(), 4000);
  }

  toggleChat() { this.chatOpen.update(v => !v); }

  sendMessage() {
    const text = this.chatInput().trim();
    if (!text || this.chatSending()) return;
    this.chatInput.set('');
    this.addMessage('user', text);
    this.chatSending.set(true);
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ message: text, context: 'dashboard' }));
    }
    setTimeout(() => this.chatSending.set(false), 500);
  }

  onChatKey(event: KeyboardEvent) {
    if (event.key === 'Enter') { this.sendMessage(); }
  }

  private addMessage(role: 'user' | 'assistant', text: string) {
    this.chatMessages.update(m => [...m, { id: `${role}-${Date.now()}`, role, text }]);
  }
}
