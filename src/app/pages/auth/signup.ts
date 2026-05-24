import { Component, inject, signal, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink, Router, ActivatedRoute } from '@angular/router';
import { CommonModule } from '@angular/common';
import { NbCardModule, NbButtonModule, NbInputModule, NbIconModule, NbSpinnerModule } from '@nebular/theme';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { OnboardingService } from '../../libs/service/onboarding.service';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-signup',
  templateUrl: './signup.html',
  styleUrl: './signup.scss',
  imports: [CommonModule, FormsModule, RouterLink, TranslatePipe, NbCardModule, NbButtonModule, NbInputModule, NbIconModule, NbSpinnerModule],
})
export class Signup implements OnInit {
  private translate = inject(TranslateService);

  password = '';
  confirmPassword = '';

  validating = signal(true);
  tokenValid = signal(false);
  loading = signal(false);
  error = signal<string | null>(null);

  // Pre-filled from onboarding token
  email = signal('');
  planName = signal('');

  // Workspace OAuth path (Google/Microsoft callback)
  workspaceConnected = signal<'google' | 'microsoft' | null>(null);

  private token = '';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private onboarding: OnboardingService,
  ) {}

  async ngOnInit(): Promise<void> {
    const params = this.route.snapshot.queryParamMap;
    this.token = params.get('token') ?? '';

    // Detect return from workspace OAuth
    const connected = params.get('calendar_connected');
    if (connected === 'google' || connected === 'microsoft') {
      this.workspaceConnected.set(connected);
    }

    if (!this.token) {
      this.error.set(this.translate.instant('auth.signup.invalidOrMissingToken'));
      this.validating.set(false);
      return;
    }

    try {
      const progress = await this.onboarding.getProgress(this.token);

      if (progress.is_complete) {
        // Onboarding already done — send to login
        this.router.navigate(['/auth/login']);
        return;
      }

      this.email.set(progress.email);
      this.planName.set(this.formatPlan(progress.plan_slug));
      this.tokenValid.set(true);

      // If we got here from a workspace OAuth callback, Cognito user is already created
      // Just show the confirmation state (no password needed)
    } catch {
      this.error.set(this.translate.instant('auth.signup.linkInvalidOrExpired'));
    } finally {
      this.validating.set(false);
    }
  }

  async onSubmit(): Promise<void> {
    if (this.password !== this.confirmPassword) {
      this.error.set(this.translate.instant('auth.signup.mismatch'));
      return;
    }
    this.loading.set(true);
    this.error.set(null);
    try {
      await this.onboarding.activateAccount(this.token, this.password);
      this.router.navigate(['/onboarding'], { queryParams: { token: this.token } });
    } catch (err: any) {
      const status = err?.status;
      if (status === 409) {
        this.error.set(this.translate.instant('auth.signup.alreadyActivated'));
      } else if (status === 401) {
        this.error.set(this.translate.instant('auth.signup.paymentNotFound', { email: 'support@vorrai.co' }));
      } else {
        this.error.set(err?.error?.message ?? err?.message ?? this.translate.instant('auth.signup.activationFailed'));
      }
    } finally {
      this.loading.set(false);
    }
  }

  continueToOnboarding(): void {
    this.router.navigate(['/onboarding'], { queryParams: { token: this.token } });
  }

  connectGoogle(): void {
    window.location.href = `${environment.apiUrl}/onboarding/calendar/google?token=${this.token}`;
  }

  connectMicrosoft(): void {
    window.location.href = `${environment.apiUrl}/onboarding/calendar/microsoft?token=${this.token}`;
  }

  private formatPlan(slug: string): string {
    const map: Record<string, string> = {
      'vendia-voice-engine': 'Vendia Voice Engine',
      'hero-content-engine': 'Hero Content Engine',
      'ai-employee': 'AI Employee',
      'client-ascension-system': 'Client Ascension System',
    };
    return map[slug] ?? slug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  }
}
