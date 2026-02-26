import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { NbCardModule, NbButtonModule, NbInputModule } from '@nebular/theme';
import { confirmSignIn } from 'aws-amplify/auth';

@Component({
  selector: 'app-new-password',
  templateUrl: './new-password.html',
  imports: [CommonModule, FormsModule, NbCardModule, NbButtonModule, NbInputModule],
})
export class NewPassword {
  password = '';
  confirmPassword = '';
  loading = signal(false);
  error = signal<string | null>(null);

  constructor(private router: Router) {}

  async onSubmit(): Promise<void> {
    if (this.password !== this.confirmPassword) {
      this.error.set('Passwords do not match.');
      return;
    }
    this.loading.set(true);
    this.error.set(null);
    try {
      await confirmSignIn({ challengeResponse: this.password });
      this.router.navigate(['/dashboard']);
    } catch (err: any) {
      this.error.set(err?.message ?? 'Failed to set new password.');
    } finally {
      this.loading.set(false);
    }
  }
}
