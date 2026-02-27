import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NbCardModule, NbButtonModule, NbInputModule } from '@nebular/theme';
import { AuthService } from '../../libs/service/auth.service';

@Component({
  selector: 'app-mfa-challenge',
  templateUrl: './mfa-challenge.html',
  styleUrl: './mfa-challenge.scss',
  imports: [CommonModule, FormsModule, NbCardModule, NbButtonModule, NbInputModule],
})
export class MfaChallenge {
  code    = '';
  loading = signal(false);
  error   = signal<string | null>(null);

  constructor(private auth: AuthService) {}

  async onSubmit(): Promise<void> {
    const code = this.code.replace(/\s/g, '');
    if (code.length !== 6) {
      this.error.set('Enter the 6-digit code from your authenticator app.');
      return;
    }
    this.loading.set(true);
    this.error.set(null);
    try {
      await this.auth.confirmMfa(code);
    } catch (err: any) {
      this.error.set(err?.message ?? 'Invalid code. Try again.');
    } finally {
      this.loading.set(false);
    }
  }
}
