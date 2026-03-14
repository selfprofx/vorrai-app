import { Component, OnInit, signal, computed, inject, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import {
  NbCardModule, NbButtonModule, NbInputModule, NbIconModule,
  NbBadgeModule, NbAlertModule, NbSpinnerModule, NbToggleModule,
  NbSelectModule, NbOptionModule, NbToastrService,
} from '@nebular/theme';
import { NbEvaIconsModule } from '@nebular/eva-icons';
import {
  setUpTOTP,
  verifyTOTPSetup,
  updateMFAPreference,
  fetchMFAPreference,
  updatePassword,
} from 'aws-amplify/auth';
import { AuthService } from '../../libs/service/auth.service';
import { DashboardMetricsService } from '../../libs/service/dashboard-metrics.service';
import { TenantSettingsService } from '../../libs/service/tenant-settings.service';
import { NotificationService, NotificationPreferences } from '../../libs/service/notification.service';
import { TenantDetailService } from '../../libs/service/tenant-detail.service';
import { CrewMemoryService } from '../../libs/service/crew-memory.service';
import type { AvailableHour } from '../../libs/model/tenant-detail';
import type { CrewFlowInfo } from '../../libs/model/crew-memory';

type MfaStatus = 'loading' | 'disabled' | 'enabled' | 'setting-up' | 'verifying';

interface ModuleInfo {
  num: string;
  name: string;
  subtitle: string;
  description: string;
  color: string;
  features: string[];
}

const ALL_MODULES: ModuleInfo[] = [
  {
    num: '01',
    name: 'Vendia Voice Engine',
    subtitle: 'The Core AI Clone',
    description: 'Your AI sales clone. Deployed 24/7 across every DM and comment thread. It runs proven SPIN selling frameworks to engage, qualify, and book pre-sold 5-figure deals onto your calendar while you sleep.',
    color: '#FFD700',
    features: ['SPIN Selling flows built-in', 'Personalized follow-up emails'],
  },
  {
    num: '02',
    name: 'Hero Content Engine',
    subtitle: 'Omni-Channel Presence',
    description: 'Omni-channel omnipresence. We transform a single 2-minute voice note into a month of high-converting LinkedIn posts, video scripts, and email sequences. 100% in your authentic voice. Zero content fatigue.',
    color: '#F9E79F',
    features: ['Ad Compliance Intelligence included'],
  },
  {
    num: '03',
    name: 'AI Employee',
    subtitle: 'Business Operator',
    description: 'Your flawless operator. Manages your calendar, drafts pristine replies, flags hot leads, and executes operational tasks straight from your smartphone. Never sleeps. Never misses a follow-up. Never makes a typo.',
    color: '#00FFFF',
    features: ['Never sleeps. Never misses a follow-up.'],
  },
  {
    num: '04',
    name: 'Client Ascension System',
    subtitle: 'Post-Sale Automation',
    description: 'Automated LTV expansion. Once the sale is closed, the system deploys milestone-triggered onboarding, retention, and upsell campaigns to seamlessly turn one-time buyers into high-ticket, long-term retainer clients.',
    color: '#FFD700',
    features: ['Turns one-time buyers into retainer clients'],
  },
];
type TotpSetupDetails = { sharedSecret: string; setupUri: string } | null;

@Component({
  selector: 'app-settings',
  templateUrl: './settings.html',
  styleUrl: './settings.scss',
  imports: [
    CommonModule, FormsModule,
    NbCardModule, NbButtonModule, NbInputModule, NbIconModule,
    NbBadgeModule, NbAlertModule, NbSpinnerModule, NbToggleModule,
    NbSelectModule, NbOptionModule, NbEvaIconsModule,
  ],
})
export class Settings implements OnInit {
  private auth            = inject(AuthService);
  private toastr          = inject(NbToastrService);
  private metrics         = inject(DashboardMetricsService);
  private route           = inject(ActivatedRoute);
  readonly tenantSettings = inject(TenantSettingsService);
  readonly tenantDetail   = inject(TenantDetailService);
  readonly crewMemory     = inject(CrewMemoryService);

  // Tab selection via query param (?tab=profile)
  activeTab = signal<string>('profile');

  // ── Profile ────────────────────────────────────────────────
  readonly tenantId  = computed(() => this.auth.getTenantId() ?? '—');
  readonly isManager = computed(() => this.auth.isManager());

  // ── Plans ──────────────────────────────────────────────────
  readonly activePlans = signal<Array<{ plan_slug: string; plan_name: string; module_num: string; activated_at: string }>>([]);
  readonly plansLoading = signal(true);

  readonly allModules = ALL_MODULES;

  readonly activeModuleNums = computed(() =>
    new Set(this.activePlans().map(p => p.module_num))
  );

  moduleStatus(num: string): 'active' | 'available' {
    return this.activeModuleNums().has(num) ? 'active' : 'available';
  }

  moduleActivatedAt(num: string): string | null {
    return this.activePlans().find(p => p.module_num === num)?.activated_at ?? null;
  }

  // ── 2FA ───────────────────────────────────────────────────
  mfaStatus  = signal<MfaStatus>('loading');
  totpSetup  = signal<TotpSetupDetails>(null);
  verifyCode = '';
  mfaError   = signal<string | null>(null);

  readonly mfaEnabled = computed(() => this.mfaStatus() === 'enabled');

  // ── Change password ────────────────────────────────────────
  oldPassword     = '';
  newPassword     = '';
  confirmPassword = '';
  pwLoading  = signal(false);
  pwError    = signal<string | null>(null);
  pwSuccess  = signal(false);

  // ── Copy helper ────────────────────────────────────────────
  copied = signal(false);

  // ── Notifications ────────────────────────────────────────
  readonly notificationService = inject(NotificationService);
  notifPrefs: NotificationPreferences = { ...this.notificationService.preferences() };
  notifSaving = signal(false);

  // ── Tenant Settings (was AI Limits) ──────────────────────
  aiLimitsMaxChat       = 512;
  aiLimitsMaxAgent      = 2048;
  aiLimitsMaxContentJobs = 100;
  aiLimitsAutoApprove   = false;
  contentJobsUsedMonth  = 0;
  contentJobsLimitMonthly = 100;

  // ── Tenant Detail (Communication & Social) ──────────────
  tdBrandStyle      = '';
  tdTimezone         = '';
  tdLangs           = '';
  tdAvailableHours: AvailableHour[] = [];
  tdInstagram       = '';
  tdFacebook        = '';
  tdLinkedin        = '';
  tdTiktok          = '';
  tdYoutube         = '';

  // ── Booking Configuration ─────────────────────────────────
  tdBookingEnabled          = false;
  tdMeetingType             = 'online';
  tdMeetingTool             = 'google_meet';
  tdMeetingUrl              = '';
  tdMeetingAddress          = '';
  tdMeetingDurationMinutes  = 60;
  tdMaxSlotsToShow          = 5;
  tdReminderEnabled         = true;
  tdReminderMinutesBefore   = 30;
  tdBufferBetweenMeetingsMinutes = 0;

  readonly meetingToolOptions = [
    { value: 'google_meet', label: 'Google Meet' },
    { value: 'zoom', label: 'Zoom' },
    { value: 'skype', label: 'Skype' },
    { value: 'microsoft_teams', label: 'Microsoft Teams' },
    { value: 'custom', label: 'Custom Link' },
  ];

  readonly durationOptions = [15, 30, 45, 60, 90, 120];

  readonly weekdays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  readonly timezoneOptions = [
    { value: 'America/Sao_Paulo',    label: 'America/Sao_Paulo (BRT)' },
    { value: 'America/New_York',     label: 'America/New_York (ET)' },
    { value: 'America/Chicago',      label: 'America/Chicago (CT)' },
    { value: 'America/Denver',       label: 'America/Denver (MT)' },
    { value: 'America/Los_Angeles',  label: 'America/Los_Angeles (PT)' },
    { value: 'Europe/London',        label: 'Europe/London (GMT)' },
    { value: 'Europe/Paris',         label: 'Europe/Paris (CET)' },
    { value: 'Europe/Berlin',        label: 'Europe/Berlin (CET)' },
    { value: 'Asia/Tokyo',           label: 'Asia/Tokyo (JST)' },
    { value: 'Australia/Sydney',     label: 'Australia/Sydney (AEST)' },
    { value: 'UTC',                  label: 'UTC' },
  ];

  async ngOnInit() {
    // Check for tab query param (e.g. ?tab=profile)
    this.route.queryParams.subscribe(params => {
      if (params['tab']) {
        this.activeTab.set(params['tab']);
      }
    });

    await Promise.all([this.loadMfaStatus(), this.loadPlans(), this.tenantSettings.load(), this.notificationService.loadPreferences()]);
    const s = this.tenantSettings.settings();
    if (s) {
      this.aiLimitsMaxChat          = s.max_chat_input_chars;
      this.aiLimitsMaxAgent         = s.max_agent_input_chars;
      this.aiLimitsMaxContentJobs   = s.max_content_jobs_per_month ?? 100;
      this.aiLimitsAutoApprove      = s.auto_approve_sequences ?? false;
      this.contentJobsUsedMonth     = s.content_jobs_used_month ?? 0;
      this.contentJobsLimitMonthly  = s.content_jobs_limit_monthly ?? 100;
    }
    this.notifPrefs = { ...this.notificationService.preferences() };

    // Load tenant detail for manager Settings tab
    if (this.isManager()) {
      await this.tenantDetail.load();
      const d = this.tenantDetail.detail();
      if (d) {
        this.tdBrandStyle     = d.brand_communication_style ?? '';
        this.tdTimezone        = d.timezone ?? '';
        this.tdLangs           = d.langs ?? '';
        this.tdAvailableHours  = d.available_hours ?? [];
        this.tdInstagram       = d.instagram_handle ?? '';
        this.tdFacebook        = d.facebook_page ?? '';
        this.tdLinkedin        = d.linkedin_url ?? '';
        this.tdTiktok          = d.tiktok_handle ?? '';
        this.tdYoutube         = d.youtube_channel ?? '';

        this.tdBookingEnabled         = d.booking_enabled ?? false;
        this.tdMeetingType            = d.meeting_type ?? 'online';
        this.tdMeetingTool            = d.meeting_tool ?? 'google_meet';
        this.tdMeetingUrl             = d.meeting_url ?? '';
        this.tdMeetingAddress         = d.meeting_address ?? '';
        this.tdMeetingDurationMinutes = d.meeting_duration_minutes ?? 60;
        this.tdMaxSlotsToShow         = d.max_slots_to_show ?? 5;
        this.tdReminderEnabled        = d.reminder_enabled ?? true;
        this.tdReminderMinutesBefore  = d.reminder_minutes_before ?? 30;
        this.tdBufferBetweenMeetingsMinutes = d.buffer_between_meetings_minutes ?? 0;
      }
    }
  }

  async saveTenantSettings() {
    try {
      await this.tenantSettings.save({
        max_chat_input_chars:        this.aiLimitsMaxChat,
        max_agent_input_chars:       this.aiLimitsMaxAgent,
        max_content_jobs_per_month:  this.aiLimitsMaxContentJobs,
        auto_approve_sequences:      this.aiLimitsAutoApprove,
      });
      this.toastr.success('Settings updated successfully.', 'Settings Saved');
    } catch {
      this.toastr.danger(this.tenantSettings.error() ?? 'Failed to save settings.', 'Error');
    }
  }

  async saveTenantDetail() {
    try {
      await this.tenantDetail.save({
        brand_communication_style: this.tdBrandStyle || null,
        timezone: this.tdTimezone || null,
        langs: this.tdLangs || null,
        available_hours: this.tdAvailableHours,
        instagram_handle: this.tdInstagram || null,
        facebook_page: this.tdFacebook || null,
        linkedin_url: this.tdLinkedin || null,
        tiktok_handle: this.tdTiktok || null,
        youtube_channel: this.tdYoutube || null,
        booking_enabled: this.tdBookingEnabled,
        meeting_type: this.tdMeetingType || null,
        meeting_tool: this.tdMeetingTool || null,
        meeting_url: this.tdMeetingUrl || null,
        meeting_address: this.tdMeetingAddress || null,
        meeting_duration_minutes: this.tdMeetingDurationMinutes,
        max_slots_to_show: this.tdMaxSlotsToShow,
        reminder_enabled: this.tdReminderEnabled,
        reminder_minutes_before: this.tdReminderMinutesBefore,
        buffer_between_meetings_minutes: this.tdBufferBetweenMeetingsMinutes,
      });
      this.toastr.success('Tenant detail updated.', 'Saved');
    } catch {
      this.toastr.danger(this.tenantDetail.error() ?? 'Failed to save tenant detail.', 'Error');
    }
  }

  addAvailableHour() {
    this.tdAvailableHours = [...this.tdAvailableHours, { day_of_week: 'Monday', start_time: '09:00', end_time: '17:00' }];
  }

  removeAvailableHour(index: number) {
    this.tdAvailableHours = this.tdAvailableHours.filter((_, i) => i !== index);
  }

  async saveNotifPrefs(): Promise<void> {
    this.notifSaving.set(true);
    try {
      await this.notificationService.savePreferences(this.notifPrefs);
      this.toastr.success('Notification preferences saved.', 'Notifications');
    } catch {
      this.toastr.danger('Failed to save notification preferences.', 'Error');
    } finally {
      this.notifSaving.set(false);
    }
  }

  requestDesktopPermission(): void {
    if (typeof Notification !== 'undefined' && Notification.permission !== 'granted') {
      Notification.requestPermission();
    }
  }

  async loadPlans(): Promise<void> {
    this.plansLoading.set(true);
    try {
      const m = await this.metrics.getMetrics();
      this.activePlans.set(m.active_plans ?? []);
    } catch {
      // Non-critical — leave empty
    } finally {
      this.plansLoading.set(false);
    }
  }

  // ── 2FA: load current status ───────────────────────────────

  async loadMfaStatus() {
    this.mfaStatus.set('loading');
    this.mfaError.set(null);
    try {
      const prefs = await fetchMFAPreference();
      const isEnabled = (prefs.enabled ?? []).includes('TOTP') || prefs.preferred === 'TOTP';
      this.mfaStatus.set(isEnabled ? 'enabled' : 'disabled');
    } catch {
      this.mfaStatus.set('disabled');
    }
  }

  // ── 2FA: begin enrollment ──────────────────────────────────

  async beginSetup() {
    this.mfaStatus.set('loading');
    this.mfaError.set(null);
    this.verifyCode = '';
    try {
      const details = await setUpTOTP();
      const uri = details.getSetupUri('Vendia', this.auth.getTenantId() ?? 'user').href;
      this.totpSetup.set({ sharedSecret: details.sharedSecret, setupUri: uri });
      this.mfaStatus.set('setting-up');
    } catch (e: any) {
      this.mfaError.set(e?.message ?? 'Failed to start 2FA setup.');
      this.mfaStatus.set('disabled');
    }
  }

  // ── 2FA: confirm enrollment ────────────────────────────────

  async confirmSetup() {
    const code = this.verifyCode.replace(/\s/g, '');
    if (code.length !== 6) {
      this.mfaError.set('Enter the 6-digit code from your authenticator app.');
      return;
    }
    this.mfaStatus.set('verifying');
    this.mfaError.set(null);
    try {
      await verifyTOTPSetup({ code });
      await updateMFAPreference({ totp: 'PREFERRED' });
      this.totpSetup.set(null);
      this.verifyCode = '';
      this.mfaStatus.set('enabled');
      this.toastr.success('Two-factor authentication is now active on your account.', '2FA Enabled');
    } catch (e: any) {
      this.mfaError.set(e?.message ?? 'Invalid code. Check your authenticator app and try again.');
      this.mfaStatus.set('setting-up');
    }
  }

  cancelSetup() {
    this.totpSetup.set(null);
    this.verifyCode = '';
    this.mfaError.set(null);
    this.mfaStatus.set('disabled');
  }

  // ── 2FA: disable ──────────────────────────────────────────

  async disableMfa() {
    this.mfaStatus.set('loading');
    this.mfaError.set(null);
    try {
      await updateMFAPreference({ totp: 'DISABLED' });
      this.mfaStatus.set('disabled');
      this.toastr.warning('Two-factor authentication has been disabled.', '2FA Disabled');
    } catch (e: any) {
      this.mfaError.set(e?.message ?? 'Failed to disable 2FA.');
      this.mfaStatus.set('enabled');
    }
  }

  // ── Copy secret key to clipboard ──────────────────────────

  async copySecret() {
    const secret = this.totpSetup()?.sharedSecret;
    if (!secret) return;
    try {
      await navigator.clipboard.writeText(secret);
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 2000);
    } catch { /* clipboard unavailable */ }
  }

  // ── AI Memory ──────────────────────────────────────────────
  memoryLoaded       = signal(false);
  memoryViewContent  = signal<string>('');
  memoryViewFlowName = signal<string | null>(null);
  memoryDeleting     = signal<string | null>(null);

  async loadMemories(): Promise<void> {
    if (this.memoryLoaded()) return;
    await this.crewMemory.load();
    this.memoryLoaded.set(true);
  }

  getMemoryRecord(flowName: string) {
    return this.crewMemory.memories().find(m => m.crew_flow_name === flowName) ?? null;
  }

  getFlowLabel(flowName: string): string {
    const flow = this.crewMemory.availableFlows().find(f => f.name === flowName);
    return flow?.label ?? flowName;
  }

  getFlowDescription(flowName: string): string {
    const flow = this.crewMemory.availableFlows().find(f => f.name === flowName);
    return flow?.description ?? '';
  }

  async toggleMemory(flowName: string, enabled: boolean): Promise<void> {
    try {
      await this.crewMemory.toggleEnabled(flowName, enabled);
      this.toastr.success(`Memory ${enabled ? 'enabled' : 'disabled'} for ${this.getFlowLabel(flowName)}.`, 'AI Memory');
    } catch {
      this.toastr.danger('Failed to update memory setting.', 'Error');
    }
  }

  async viewMemoryContent(flowName: string): Promise<void> {
    if (this.memoryViewFlowName() === flowName) {
      this.memoryViewFlowName.set(null);
      this.memoryViewContent.set('');
      return;
    }
    const content = await this.crewMemory.getContent(flowName);
    this.memoryViewContent.set(content || '(No memory content yet)');
    this.memoryViewFlowName.set(flowName);
  }

  async deleteMemory(flowName: string): Promise<void> {
    this.memoryDeleting.set(flowName);
    try {
      await this.crewMemory.deleteMemory(flowName);
      this.memoryViewFlowName.set(null);
      this.memoryViewContent.set('');
      this.toastr.warning(`Memory deleted for ${this.getFlowLabel(flowName)}.`, 'Deleted');
    } catch {
      this.toastr.danger('Failed to delete memory.', 'Error');
    } finally {
      this.memoryDeleting.set(null);
    }
  }

  formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    if (bytes < 1024) return `${bytes} B`;
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  // ── Change password ────────────────────────────────────────

  async changePassword() {
    if (this.newPassword !== this.confirmPassword) {
      this.pwError.set('New passwords do not match.');
      return;
    }
    if (this.newPassword.length < 10) {
      this.pwError.set('Password must be at least 10 characters.');
      return;
    }
    this.pwLoading.set(true);
    this.pwError.set(null);
    this.pwSuccess.set(false);
    try {
      await updatePassword({ oldPassword: this.oldPassword, newPassword: this.newPassword });
      this.oldPassword = '';
      this.newPassword = '';
      this.confirmPassword = '';
      this.pwSuccess.set(true);
      this.toastr.success('Your password has been updated.', 'Password Changed');
    } catch (e: any) {
      this.pwError.set(e?.message ?? 'Failed to change password. Check your current password.');
    } finally {
      this.pwLoading.set(false);
    }
  }
}
