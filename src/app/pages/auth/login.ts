import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { NbCardModule, NbButtonModule, NbInputModule, NbIconModule } from '@nebular/theme';
import { AuthService } from '../../libs/service/auth.service';

@Component({
  selector: 'app-login',
  templateUrl: './login.html',
  styleUrl: './login.scss',
  imports: [CommonModule, FormsModule, RouterLink, NbCardModule, NbButtonModule, NbInputModule, NbIconModule],
})
export class Login {
  email = '';
  password = '';
  loading = signal(false);
  error = signal<string | null>(null);

  constructor(private auth: AuthService) {}

  async onSubmit(): Promise<void> {
    if (!this.email || !this.password) return;
    this.loading.set(true);
    this.error.set(null);
    try {
      await this.auth.signIn(this.email, this.password);
    } catch (err: any) {
      this.error.set(err?.message ?? 'Sign in failed. Please check your credentials.');
    } finally {
      this.loading.set(false);
    }
  }

  async signInGoogle(): Promise<void> {
    this.error.set(null);
    try {
      await this.auth.signInWithGoogle();
    } catch (err: any) {
      this.error.set(err?.message ?? 'Google sign-in failed.');
    }
  }

  async signInMicrosoft(): Promise<void> {
    this.error.set(null);
    try {
      await this.auth.signInWithMicrosoft();
    } catch (err: any) {
      this.error.set(err?.message ?? 'Microsoft sign-in failed.');
    }
  }
}
