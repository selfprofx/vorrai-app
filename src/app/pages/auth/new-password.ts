import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { NbCardModule, NbButtonModule, NbInputModule } from '@nebular/theme';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { confirmSignIn } from 'aws-amplify/auth';
import { AuthService } from '../../libs/service/auth.service';

@Component({
  selector: 'app-new-password',
  templateUrl: './new-password.html',
  styleUrl: './new-password.scss',
  imports: [CommonModule, FormsModule, TranslatePipe, NbCardModule, NbButtonModule, NbInputModule],
})
export class NewPassword {
  private translate = inject(TranslateService);

  password = '';
  confirmPassword = '';
  loading = signal(false);
  error = signal<string | null>(null);

  constructor(private auth: AuthService, private router: Router) {}

  async onSubmit(): Promise<void> {
    if (this.password !== this.confirmPassword) {
      this.error.set(this.translate.instant('auth.newPassword.mismatch'));
      return;
    }
    this.loading.set(true);
    this.error.set(null);
    try {
      await confirmSignIn({ challengeResponse: this.password });
      await this.auth.restoreSession();
      this.router.navigate(['/dashboard']);
    } catch (err: any) {
      this.error.set(err?.message ?? this.translate.instant('auth.newPassword.failed'));
    } finally {
      this.loading.set(false);
    }
  }
}
