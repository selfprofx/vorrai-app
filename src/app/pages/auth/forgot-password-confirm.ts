import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import { NbCardModule, NbButtonModule, NbInputModule } from '@nebular/theme';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { AuthService } from '../../libs/service/auth.service';
import { TurnstileComponent } from '../../shared/turnstile.component';

@Component({
  selector: 'app-forgot-password-confirm',
  templateUrl: './forgot-password-confirm.html',
  styleUrl: './forgot-password-confirm.scss',
  imports: [CommonModule, FormsModule, RouterLink, TranslatePipe, NbCardModule, NbButtonModule, NbInputModule, TurnstileComponent],
})
export class ForgotPasswordConfirm implements OnInit {
  private translate = inject(TranslateService);
  private auth = inject(AuthService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  email = '';
  code = '';
  password = '';
  confirmPassword = '';
  captchaToken = signal<string>('');
  loading = signal(false);
  error = signal<string | null>(null);

  ngOnInit(): void {
    this.email = (this.route.snapshot.queryParamMap.get('email') ?? '').toLowerCase();
  }

  onCaptcha(token: string): void {
    this.captchaToken.set(token);
  }

  onCaptchaExpired(): void {
    this.captchaToken.set('');
  }

  async onSubmit(): Promise<void> {
    if (!this.email || !this.code || !this.password || !this.captchaToken()) return;
    if (this.password !== this.confirmPassword) {
      this.error.set(this.translate.instant('auth.forgot.mismatch'));
      return;
    }
    this.loading.set(true);
    this.error.set(null);
    try {
      await this.auth.confirmForgotPassword(
        this.email.trim().toLowerCase(),
        this.code.trim(),
        this.password,
        this.captchaToken(),
      );
      this.router.navigate(['/auth/login'], { queryParams: { reset: 'ok' } });
    } catch (err: any) {
      this.error.set(
        err?.error?.Message ??
        err?.error?.message ??
        err?.message ??
        this.translate.instant('auth.forgot.confirmFailed'),
      );
    } finally {
      this.loading.set(false);
    }
  }
}
