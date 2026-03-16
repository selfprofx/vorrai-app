import { Component, OnInit, OnDestroy, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { NbCardModule, NbButtonModule, NbInputModule, NbStepperModule,
         NbToastrService, NbIconModule, NbBadgeModule, NbTagModule,
         NbProgressBarModule, NbRadioModule } from '@nebular/theme';
import { OnboardingService, OnboardingProgress } from '../../libs/service/onboarding.service';
import { environment } from '../../../environments/environment';

const WSS_URL = environment.wssUrl || '';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  text: string;
}

@Component({
  selector: 'app-onboarding',
  templateUrl: './onboarding.html',
  styleUrl: './onboarding.scss',
  imports: [
    CommonModule, FormsModule,
    NbCardModule, NbButtonModule, NbInputModule, NbStepperModule,
    NbIconModule, NbBadgeModule, NbTagModule, NbProgressBarModule, NbRadioModule,
  ],
})
export class Onboarding implements OnInit, OnDestroy {
  token = signal('');
  progress = signal<OnboardingProgress | null>(null);
  loading = signal(true);
  saving = signal(false);
  completing = signal(false);
  error = signal<string | null>(null);
  sesChecking = signal(false);

  // ── Stage data (bound to forms) ───────────────────────────────────────────
  stage1 = signal<Record<string, any>>({});
  stage2 = signal<Record<string, any>>({});
  stage3 = signal<Record<string, any>>({});
  stage4 = signal<Record<string, any>>({});
  stage5 = signal<Record<string, any>>({});

  // ── Knowledge Ingestion (Stage 5) ─────────────────────────────────────────
  knowledgeFiles = signal<File[]>([]);
  youtubeUrls = signal<string[]>([]);
  newYoutubeUrl = signal('');
  textInputs = signal<Array<{ title: string; content: string }>>([]);
  ingestionSources = signal<Array<{ source_id: string; title: string; status: string; source_type: string; chunk_count: number }>>([]);
  ingestionPolling = signal(false);
  uploading = signal(false);
  private ingestionTimer: any = null;

  // ── Chat (onboarding AI) ──────────────────────────────────────────────────
  chatMessages = signal<ChatMessage[]>([]);
  chatInput = signal('');
  chatSending = signal(false);
  chatOpen = signal(false);
  private ws: WebSocket | null = null;
  private connectionId: string | null = null;

  // ── Brand identity (collapsible) ─────────────────────────────────────────
  showBrandFields = signal(false);

  // ── Booking config (Stage 4) ────────────────────────────────────────────
  readonly meetingToolOptions = [
    { value: 'google_meet', label: 'Google Meet' },
    { value: 'zoom', label: 'Zoom' },
    { value: 'skype', label: 'Skype' },
    { value: 'microsoft_teams', label: 'Microsoft Teams' },
    { value: 'custom', label: 'Custom Link' },
  ];
  readonly durationOptions = [15, 30, 45, 60, 90, 120];
  readonly detectedTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  // ── Feature interest ──────────────────────────────────────────────────────
  featureInterestModal = signal<{ slug: string; name: string } | null>(null);
  featureMessage = signal('');

  // ── Computed ──────────────────────────────────────────────────────────────
  readonly currentStage = computed(() => this.progress()?.current_stage || 1);
  readonly completionPct = computed(() => {
    const p = this.progress();
    if (!p) return 0;
    return Math.min(100, Math.round((p.completed_stages.length / 5) * 100));
  });
  readonly hasPlan02 = computed(() =>
    this.progress()?.plan_slug?.includes('hero-content') || false
  );

  readonly MODULES = [
    { num: '01', title: 'Voice Engine', subtitle: 'The Core AI Clone', available: true, color: '#FFD700',
      desc: 'Your AI sales clone, deployed 24/7 across every DM and inbox.' },
    { num: '02', title: 'Hero Content Engine', subtitle: 'Omni-Channel Presence', available: true, color: '#F9E79F',
      desc: 'Transforms your ideas into LinkedIn posts, carousels, video scripts.' },
    { num: '03', title: 'AI Employee', subtitle: 'Built on OpenClaw', available: false, color: '#00FFFF',
      slug: 'ai-employee', name: 'AI Employee',
      desc: 'Runs your entire business from your smartphone. Coming soon.' },
    { num: '04', title: 'Client Ascension', subtitle: 'Post-Sale Automation', available: false, color: '#FFD700',
      slug: 'client-ascension-system', name: 'Client Ascension System',
      desc: 'Post-sale automation that turns buyers into retainer clients. Coming soon.' },
  ];

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private onboardingService: OnboardingService,
    private toastr: NbToastrService,
  ) {}

  async ngOnInit() {
    const t = this.route.snapshot.queryParamMap.get('token') || '';
    this.token.set(t);
    if (!t) {
      this.error.set('No onboarding token found. Please check your setup email.');
      this.loading.set(false);
      return;
    }
    await this.loadProgress();
    this.connectWebSocket();
    this.addSystemMessage(`Welcome to Vendia! I'm your AI Onboarding Guide. I'll help you set up your Authority Engine step by step. What questions do you have about Stage ${this.currentStage()}?`);

    const params = this.route.snapshot.queryParamMap;
    const connected = params.get('calendar_connected');
    const calError  = params.get('calendar_error');
    if (connected) {
      const label = connected === 'google' ? 'Google Calendar' : 'Microsoft Calendar';
      this.toastr.success(`${label} connected!`, 'Calendar');
      await this.loadProgress();
    } else if (calError) {
      this.toastr.danger(`Calendar connection failed: ${calError}`, 'Error');
    }
  }

  ngOnDestroy() {
    this.ws?.close();
    if (this.ingestionTimer) clearInterval(this.ingestionTimer);
  }

  // ── Progress ──────────────────────────────────────────────────────────────

  async loadProgress() {
    this.loading.set(true);
    try {
      const p = await this.onboardingService.getProgress(this.token());
      this.progress.set(p);
      const sd = p.stage_data || {};
      this.stage1.set({ ...sd['1'] });
      this.stage2.set({ ...sd['2'] });
      this.stage3.set({ ...sd['3'] });
      this.stage4.set({ ...sd['4'] });
      this.stage5.set({ ...sd['5'] });
      // If Stage 5 has an active ingestion, poll status
      if (sd['5']?.['ingestion_status'] === 'processing') {
        this.pollIngestionStatus();
      }
    } catch (e: any) {
      this.error.set(e?.error?.message || 'Failed to load onboarding progress.');
    } finally {
      this.loading.set(false);
    }
  }

  async saveStage(stage: number) {
    this.saving.set(true);
    const data = stage === 1 ? this.stage1()
               : stage === 2 ? this.stage2()
               : stage === 3 ? this.stage3()
               : stage === 4 ? this.stage4()
               : this.stage5();
    try {
      const result = await this.onboardingService.saveProgress(this.token(), stage, data);
      this.progress.update(p => p ? {
        ...p,
        current_stage: result.current_stage,
        completed_stages: result.completed_stages,
      } : p);
      this.toastr.success('Progress saved', 'Stage ' + stage);
    } catch {
      this.toastr.danger('Failed to save. Please try again.', 'Error');
    } finally {
      this.saving.set(false);
    }
  }

  async checkSesStatus() {
    this.sesChecking.set(true);
    try {
      const res = await this.onboardingService.sesStatus(this.token());
      this.progress.update(p => p ? { ...p, ses_verified: res.verified } : p);
      if (res.verified) {
        this.toastr.success('Source email verified!', 'SES');
      } else {
        this.toastr.warning(`Status: ${res.status}. Check your email for the verification link.`, 'SES');
      }
    } catch {
      this.toastr.danger('Could not check SES status.', 'Error');
    } finally {
      this.sesChecking.set(false);
    }
  }

  async completeLaunch() {
    this.completing.set(true);
    try {
      await this.onboardingService.complete(this.token());
      this.toastr.success('🎉 Your Vendia account is ready! Check your email for login credentials.', 'Launched!');
      setTimeout(() => this.router.navigate(['/auth/login']), 3000);
    } catch (e: any) {
      this.toastr.danger(e?.error?.message || 'Could not complete setup.', 'Error');
    } finally {
      this.completing.set(false);
    }
  }

  openFeatureInterest(slug: string, name: string) {
    this.featureInterestModal.set({ slug, name });
    this.featureMessage.set('');
  }

  async registerInterest() {
    const feat = this.featureInterestModal();
    if (!feat) return;
    try {
      await this.onboardingService.registerInterest(
        this.token(), feat.slug, feat.name, this.featureMessage()
      );
      this.toastr.success(`You're on the waitlist for ${feat.name}!`, 'Registered');
      this.featureInterestModal.set(null);
    } catch {
      this.toastr.danger('Could not register interest.', 'Error');
    }
  }

  // ── Stage 1 helpers ────────────────────────────────────────────────────────
  setS1(key: string, val: any) { this.stage1.update(s => ({ ...s, [key]: val })); }
  setS2(key: string, val: any) { this.stage2.update(s => ({ ...s, [key]: val })); }
  setS3(key: string, val: any) { this.stage3.update(s => ({ ...s, [key]: val })); }
  setS4(key: string, val: any) { this.stage4.update(s => ({ ...s, [key]: val })); }

  parseFormFields(raw: string) {
    this.setS2('form_fields', raw.split(',').map(f => f.trim()).filter(Boolean));
  }

  // ── Stage 5: Knowledge Ingestion ─────────────────────────────────────────

  onFilesSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files) {
      this.knowledgeFiles.update(f => [...f, ...Array.from(input.files!)]);
    }
  }

  removeFile(index: number) {
    this.knowledgeFiles.update(f => f.filter((_, i) => i !== index));
  }

  addYoutubeUrl() {
    const url = this.newYoutubeUrl().trim();
    if (url) {
      this.youtubeUrls.update(u => [...u, url]);
      this.newYoutubeUrl.set('');
    }
  }

  removeYoutubeUrl(index: number) {
    this.youtubeUrls.update(u => u.filter((_, i) => i !== index));
  }

  addTextInput() {
    this.textInputs.update(t => [...t, { title: '', content: '' }]);
  }

  removeTextInput(index: number) {
    this.textInputs.update(t => t.filter((_, i) => i !== index));
  }

  updateTextInput(index: number, field: 'title' | 'content', value: string) {
    this.textInputs.update(t => t.map((item, i) => i === index ? { ...item, [field]: value } : item));
  }

  async uploadAndIngest() {
    this.uploading.set(true);
    try {
      // Upload files via presigned URLs
      for (const file of this.knowledgeFiles()) {
        const res = await this.onboardingService.uploadKnowledge(this.token(), file.name, this.getSourceType(file.name), file.name);
        await fetch(res.upload_url, { method: 'PUT', body: file, headers: { 'Content-Type': 'application/octet-stream' } });
      }

      // Start ingestion (includes youtube + text sources)
      await this.onboardingService.startIngestion(
        this.token(),
        this.youtubeUrls().map(url => ({ url, title: url })),
        this.textInputs().filter(t => t.content.trim()),
      );

      this.toastr.success('Knowledge ingestion started!', 'Stage 5');
      this.knowledgeFiles.set([]);
      this.youtubeUrls.set([]);
      this.textInputs.set([]);
      this.pollIngestionStatus();
    } catch {
      this.toastr.danger('Failed to start ingestion.', 'Error');
    } finally {
      this.uploading.set(false);
    }
  }

  async pollIngestionStatus() {
    this.ingestionPolling.set(true);
    if (this.ingestionTimer) clearInterval(this.ingestionTimer);
    this.ingestionTimer = setInterval(async () => {
      try {
        const res = await this.onboardingService.ingestionStatus(this.token());
        this.ingestionSources.set(res.sources);
        if (res.overall_status === 'complete') {
          clearInterval(this.ingestionTimer);
          this.ingestionPolling.set(false);
          this.toastr.success('Knowledge ingestion complete!', 'Stage 5');
        }
      } catch {
        clearInterval(this.ingestionTimer);
        this.ingestionPolling.set(false);
      }
    }, 5000);
  }

  private getSourceType(filename: string): string {
    const ext = filename.split('.').pop()?.toLowerCase() || '';
    if (['pdf'].includes(ext)) return 'pdf';
    if (['mp3', 'wav', 'ogg', 'm4a', 'aac'].includes(ext)) return 'audio';
    if (['mp4', 'mov', 'avi', 'webm'].includes(ext)) return 'video';
    return 'pdf';
  }

  skipStage5() {
    this.saveStage(5);
  }

  // ── Workspace OAuth ────────────────────────────────────────────────────────
  connectGoogle(): void {
    window.location.href = `${environment.apiUrl}/onboarding/calendar/google?token=${this.token()}`;
  }

  connectMicrosoft(): void {
    window.location.href = `${environment.apiUrl}/onboarding/calendar/microsoft?token=${this.token()}`;
  }

  // ── WebSocket / AI Chat ───────────────────────────────────────────────────

  private connectWebSocket() {
    if (!WSS_URL || !this.token()) return;
    const url = `${WSS_URL}?token=${encodeURIComponent(this.token())}`;
    this.ws = new WebSocket(url);

    this.ws.onopen = () => this.ws?.send('get_id');
    this.ws.onmessage = (evt) => {
      try {
        const data = JSON.parse(evt.data);
        if (data.type === 'welcome') {
          this.connectionId = data.connection_id;
        } else if (data.type === 'message' || data.text) {
          this.addAiMessage(data.text || data.message || '');
        }
      } catch { /* ignore */ }
    };
    this.ws.onclose = () => setTimeout(() => this.connectWebSocket(), 3000);
  }

  toggleChat() { this.chatOpen.update(v => !v); }

  async sendChatMessage() {
    const text = this.chatInput().trim();
    if (!text || this.chatSending()) return;
    this.chatInput.set('');
    this.addUserMessage(text);
    this.chatSending.set(true);

    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        message: text,
        stage: this.currentStage(),
      }));
    }
    // Simulate brief delay for UX (actual response comes via WS)
    setTimeout(() => this.chatSending.set(false), 500);
  }

  private addSystemMessage(text: string) {
    this.chatMessages.update(msgs => [...msgs, {
      id: `sys-${Date.now()}`, role: 'assistant', text,
    }]);
  }
  private addUserMessage(text: string) {
    this.chatMessages.update(msgs => [...msgs, {
      id: `u-${Date.now()}`, role: 'user', text,
    }]);
  }
  private addAiMessage(text: string) {
    this.chatSending.set(false);
    this.chatMessages.update(msgs => [...msgs, {
      id: `ai-${Date.now()}`, role: 'assistant', text,
    }]);
  }
}
