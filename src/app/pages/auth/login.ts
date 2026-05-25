import { Component, ViewChild, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { NbCardModule, NbButtonModule, NbInputModule, NbIconModule } from '@nebular/theme';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { AuthService } from '../../libs/service/auth.service';
import { TurnstileComponent } from '../../shared/turnstile.component';

@Component({
  selector: 'app-login',
  templateUrl: './login.html',
  styleUrl: './login.scss',
  imports: [CommonModule, FormsModule, RouterLink, TranslatePipe, NbCardModule, NbButtonModule, NbInputModule, NbIconModule, TurnstileComponent],
})
export class Login {
  private translate = inject(TranslateService);

  @ViewChild(TurnstileComponent) turnstile?: TurnstileComponent;

  email = '';
  password = '';
  captchaToken = signal<string>('');
  loading = signal(false);
  error = signal<string | null>(null);

  constructor(private auth: AuthService) {}

  onCaptcha(token: string): void {
    this.captchaToken.set(token);
  }

  onCaptchaExpired(): void {
    this.captchaToken.set('');
  }

  async onSubmit(): Promise<void> {
    if (!this.email || !this.password || !this.captchaToken()) return;
    this.loading.set(true);
    this.error.set(null);
    try {
      // Server-side captcha verification — bot floods are bounded by the
      // captcha solve rate even though the Cognito signIn call below is
      // client-side direct.
      await this.auth.precheckCaptcha('login', this.captchaToken());
      await this.auth.signIn(this.email, this.password);
    } catch (err: any) {
      this.error.set(
        err?.error?.Message ??
        err?.error?.message ??
        err?.message ??
        this.translate.instant('auth.signIn.failed'),
      );
      // Captcha tokens are single-use — force the user through a fresh
      // challenge on the next attempt.
      this.captchaToken.set('');
      this.turnstile?.reset();
    } finally {
      this.loading.set(false);
    }
  }

  async signInGoogle(): Promise<void> {
    this.error.set(null);
    try {
      await this.auth.signInWithGoogle();
    } catch (err: any) {
      this.error.set(err?.message ?? this.translate.instant('auth.signIn.ssoGoogleFailed'));
    }
  }

  async signInMicrosoft(): Promise<void> {
    this.error.set(null);
    try {
      await this.auth.signInWithMicrosoft();
    } catch (err: any) {
      this.error.set(err?.message ?? this.translate.instant('auth.signIn.ssoMicrosoftFailed'));
    }
  }
}
