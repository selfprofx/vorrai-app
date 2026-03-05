import { Component, OnInit, signal, computed, inject, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import {
  NbCardModule, NbButtonModule, NbInputModule, NbIconModule,
  NbBadgeModule, NbAlertModule, NbSpinnerModule,
  NbToastrService,
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

type MfaStatus = 'loading' | 'disabled' | 'enabled' | 'setting-up' | 'verifying';

interface ModuleInfo {
  num: string;
  name: string;
  description: string;
  color: string;
}

const ALL_MODULES: ModuleInfo[] = [
  {
    num: '01',
    name: 'Vendia Voice Engine',
    description: 'Your AI clone deployed 24/7 across DMs, comments, and inboxes. SPIN Selling flows built-in.',
    color: '#FFD700',
  },
  {
    num: '02',
    name: 'Hero Content Engine',
    description: 'Transforms your ideas into LinkedIn posts, carousels, video scripts, and email sequences in your voice.',
    color: '#F9E79F',
  },
  {
    num: '03',
    name: 'AI Employee',
    description: 'Runs your entire business operation from your smartphone — calendar, emails, hot leads, and 24/7 task execution.',
    color: '#00FFFF',
  },
  {
    num: '04',
    name: 'Client Ascension System',
    description: 'Automates the post-sale journey — onboarding, milestone-triggered upsells, and retention campaigns.',
    color: '#FFD700',
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
    NbBadgeModule, NbAlertModule, NbSpinnerModule, NbEvaIconsModule,
  ],
})
export class Settings implements OnInit {
  private auth            = inject(AuthService);
  private toastr          = inject(NbToastrService);
  private metrics         = inject(DashboardMetricsService);
  private route           = inject(ActivatedRoute);
  readonly tenantSettings = inject(TenantSettingsService);

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

  // ── AI Limits ─────────────────────────────────────────────
  aiLimitsMaxChat       = 512;
  aiLimitsMaxAgent      = 2048;
  aiLimitsAutoApprove   = false;

  async ngOnInit() {
    // Check for tab query param (e.g. ?tab=profile)
    this.route.queryParams.subscribe(params => {
      if (params['tab']) {
        this.activeTab.set(params['tab']);
      }
    });

    await Promise.all([this.loadMfaStatus(), this.loadPlans(), this.tenantSettings.load()]);
    const s = this.tenantSettings.settings();
    if (s) {
      this.aiLimitsMaxChat      = s.max_chat_input_chars;
      this.aiLimitsMaxAgent     = s.max_agent_input_chars;
      this.aiLimitsAutoApprove  = s.auto_approve_sequences ?? false;
    }
  }

  async saveAiLimits() {
    try {
      await this.tenantSettings.save({
        max_chat_input_chars:    this.aiLimitsMaxChat,
        max_agent_input_chars:   this.aiLimitsMaxAgent,
        auto_approve_sequences:  this.aiLimitsAutoApprove,
      });
      this.toastr.success('Input limits updated successfully.', 'AI Limits Saved');
    } catch {
      this.toastr.danger(this.tenantSettings.error() ?? 'Failed to save limits.', 'Error');
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
