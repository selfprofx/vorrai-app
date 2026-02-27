import { Injectable, signal, computed } from '@angular/core';
import {
  signIn,
  signOut,
  getCurrentUser,
  fetchAuthSession,
  signInWithRedirect,
  type SignInInput,
  AuthError,
} from 'aws-amplify/auth';
import { Router } from '@angular/router';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private _isAuthenticated = signal(false);
  private _tenantId = signal<string | null>(null);
  private _idToken = signal<string | null>(null);

  readonly isAuthenticated = computed(() => this._isAuthenticated());
  readonly tenantId = computed(() => this._tenantId());

  constructor(private router: Router) {
    // Restore session on app start
    this.restoreSession();
  }

  private async restoreSession(): Promise<void> {
    try {
      await getCurrentUser();
      const session = await fetchAuthSession();
      const idToken = session.tokens?.idToken?.toString() ?? null;
      const payload = session.tokens?.idToken?.payload ?? {};
      const tenantId = (payload['custom:tenant_id'] as string) ?? null;

      this._idToken.set(idToken);
      this._tenantId.set(tenantId);
      this._isAuthenticated.set(true);
    } catch {
      this._isAuthenticated.set(false);
      this._tenantId.set(null);
      this._idToken.set(null);
    }
  }

  async signIn(email: string, password: string): Promise<void> {
    const input: SignInInput = { username: email, password };
    const result = await signIn(input);

    if (result.isSignedIn) {
      await this.restoreSession();
      this.router.navigate(['/dashboard']);
    } else if (result.nextStep?.signInStep === 'CONFIRM_SIGN_IN_WITH_NEW_PASSWORD_REQUIRED') {
      // Tenant was created by admin — redirect to set new password
      this.router.navigate(['/auth/new-password']);
    }
  }

  async signOut(): Promise<void> {
    await signOut();
    this._isAuthenticated.set(false);
    this._tenantId.set(null);
    this._idToken.set(null);
    this.router.navigate(['/auth/login']);
  }

  getIdToken(): string | null {
    return this._idToken();
  }

  getTenantId(): string | null {
    return this._tenantId();
  }

  async signInWithGoogle(): Promise<void> {
    await signInWithRedirect({ provider: { custom: 'Google' } });
  }

  async signInWithMicrosoft(): Promise<void> {
    await signInWithRedirect({ provider: { custom: 'Microsoft' } });
  }

  /** Build Authorization header value for API calls. */
  authHeader(): Record<string, string> {
    const token = this._idToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  }
}
