import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  NbCardModule, NbButtonModule, NbInputModule, NbIconModule,
  NbBadgeModule, NbTabsetModule, NbAlertModule, NbSpinnerModule,
  NbToastrService,
} from '@nebular/theme';
import {
  setUpTOTP,
  verifyTOTPSetup,
  updateMFAPreference,
  fetchMFAPreference,
  updatePassword,
} from 'aws-amplify/auth';
import { AuthService } from '../../libs/service/auth.service';

type MfaStatus = 'loading' | 'disabled' | 'enabled' | 'setting-up' | 'verifying';
type TotpSetupDetails = { sharedSecret: string; setupUri: string } | null;

@Component({
  selector: 'app-settings',
  templateUrl: './settings.html',
  styleUrl: './settings.scss',
  imports: [
    CommonModule, FormsModule,
    NbCardModule, NbButtonModule, NbInputModule, NbIconModule,
    NbBadgeModule, NbTabsetModule, NbAlertModule, NbSpinnerModule,
  ],
})
export class Settings implements OnInit {
  private auth   = inject(AuthService);
  private toastr = inject(NbToastrService);

  // ── Profile ────────────────────────────────────────────────
  readonly tenantId  = computed(() => this.auth.getTenantId() ?? '—');
  readonly isManager = computed(() => this.auth.isManager());

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

  async ngOnInit() {
    await this.loadMfaStatus();
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
