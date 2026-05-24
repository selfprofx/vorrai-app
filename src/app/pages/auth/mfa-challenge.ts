import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NbCardModule, NbButtonModule, NbInputModule } from '@nebular/theme';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { AuthService } from '../../libs/service/auth.service';

@Component({
  selector: 'app-mfa-challenge',
  templateUrl: './mfa-challenge.html',
  styleUrl: './mfa-challenge.scss',
  imports: [CommonModule, FormsModule, TranslatePipe, NbCardModule, NbButtonModule, NbInputModule],
})
export class MfaChallenge {
  private translate = inject(TranslateService);

  code    = '';
  loading = signal(false);
  error   = signal<string | null>(null);

  constructor(private auth: AuthService) {}

  async onSubmit(): Promise<void> {
    const code = this.code.replace(/\s/g, '');
    if (code.length !== 6) {
      this.error.set(this.translate.instant('auth.mfa.invalidLength'));
      return;
    }
    this.loading.set(true);
    this.error.set(null);
    try {
      await this.auth.confirmMfa(code);
    } catch (err: any) {
      this.error.set(err?.message ?? this.translate.instant('auth.mfa.invalid'));
    } finally {
      this.loading.set(false);
    }
  }
}
