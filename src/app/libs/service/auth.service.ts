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
  private _groups = signal<string[]>([]);
  private _email = signal<string | null>(null);
  private _displayName = signal<string | null>(null);

  readonly isAuthenticated = computed(() => this._isAuthenticated());
  readonly tenantId = computed(() => this._tenantId());
  readonly isManager = computed(() => this._groups().includes('managers'));
  readonly displayName = computed(() => this._displayName() || this._email() || null);
  readonly email = computed(() => this._email());

  constructor(private router: Router) {
    // Restore session on app start
    this.restoreSession();
  }

  async restoreSession(): Promise<void> {
    try {
      await getCurrentUser();
      const session = await fetchAuthSession();
      const idToken = session.tokens?.idToken?.toString() ?? null;
      const payload = session.tokens?.idToken?.payload ?? {};
      const tenantId = (payload['custom:tenant_id'] as string) ?? null;
      const groups = (payload['cognito:groups'] as string[]) ?? [];
      const email = (payload['email'] as string) ?? null;
      const name = (payload['name'] as string) ?? (payload['cognito:username'] as string) ?? null;

      this._idToken.set(idToken);
      this._tenantId.set(tenantId);
      this._groups.set(groups);
      this._email.set(email);
      this._displayName.set(name);
      this._isAuthenticated.set(true);
    } catch {
      this._isAuthenticated.set(false);
      this._tenantId.set(null);
      this._idToken.set(null);
      this._groups.set([]);
      this._email.set(null);
      this._displayName.set(null);
    }
  }

  async signIn(email: string, password: string): Promise<void> {
    const input: SignInInput = { username: email, password };

    let result;
    try {
      result = await signIn(input);
    } catch (err: any) {
      // Clear stale session and retry if Amplify says user is already signed in
      if (err?.name === 'UserAlreadyAuthenticatedException') {
        await signOut();
        result = await signIn(input);
      } else {
        throw err;
      }
    }

    if (result.isSignedIn) {
      await this.restoreSession();
      this.router.navigate(['/dashboard']);
    } else if (result.nextStep?.signInStep === 'CONFIRM_SIGN_IN_WITH_NEW_PASSWORD_REQUIRED') {
      // Tenant was created by admin — redirect to set new password
      this.router.navigate(['/auth/new-password']);
    } else if (result.nextStep?.signInStep === 'CONFIRM_SIGN_IN_WITH_TOTP_CODE') {
      // User has 2FA enabled — redirect to TOTP entry
      this.router.navigate(['/auth/mfa']);
    }
  }

  /** Called by MfaChallenge page after user submits their TOTP code. */
  async confirmMfa(code: string): Promise<void> {
    const { confirmSignIn } = await import('aws-amplify/auth');
    const result = await confirmSignIn({ challengeResponse: code });
    if (result.isSignedIn) {
      await this.restoreSession();
      this.router.navigate(['/dashboard']);
    }
  }

  async signOut(): Promise<void> {
    await signOut();
    this._isAuthenticated.set(false);
    this._tenantId.set(null);
    this._idToken.set(null);
    this._groups.set([]);
    this._email.set(null);
    this._displayName.set(null);
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
