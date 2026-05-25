import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { NbCardModule, NbButtonModule, NbInputModule } from '@nebular/theme';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { AuthService } from '../../libs/service/auth.service';
import { TurnstileComponent } from '../../shared/turnstile.component';

@Component({
  selector: 'app-forgot-password',
  templateUrl: './forgot-password.html',
  styleUrl: './forgot-password.scss',
  imports: [CommonModule, FormsModule, RouterLink, TranslatePipe, NbCardModule, NbButtonModule, NbInputModule, TurnstileComponent],
})
export class ForgotPassword {
  private translate = inject(TranslateService);
  private auth = inject(AuthService);
  private router = inject(Router);

  email = '';
  captchaToken = signal<string>('');
  loading = signal(false);
  error = signal<string | null>(null);

  onCaptcha(token: string): void {
    this.captchaToken.set(token);
  }

  onCaptchaExpired(): void {
    this.captchaToken.set('');
  }

  async onSubmit(): Promise<void> {
    if (!this.email || !this.captchaToken()) return;
    this.loading.set(true);
    this.error.set(null);
    try {
      await this.auth.forgotPassword(this.email.trim().toLowerCase(), this.captchaToken());
      this.router.navigate(['/auth/forgot-password-confirm'], {
        queryParams: { email: this.email.trim().toLowerCase() },
      });
    } catch (err: any) {
      this.error.set(
        err?.error?.Message ??
        err?.error?.message ??
        err?.message ??
        this.translate.instant('auth.forgot.failed'),
      );
    } finally {
      this.loading.set(false);
    }
  }
}
