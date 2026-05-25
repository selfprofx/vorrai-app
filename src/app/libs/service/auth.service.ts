import { Injectable, inject, signal, computed } from '@angular/core';
import {
  signIn,
  signOut,
  getCurrentUser,
  fetchAuthSession,
  signInWithRedirect,
  type SignInInput,
  AuthError,
} from 'aws-amplify/auth';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { Router } from '@angular/router';
import { environment } from '../../../environments/environment';

export type PrecheckAction =
  | 'login'
  | 'signup'
  | 'forgot_password'
  | 'forgot_password_confirm'
  | 'onboarding';

interface PrecheckResponse {
  nonce: string;
  ttl: number;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);
  private _isAuthenticated = signal(false);
  private _tenantId = signal<string | null>(null);
  private _idToken = signal<string | null>(null);
  private _groups = signal<string[]>([]);
  private _email = signal<string | null>(null);
  private _displayName = signal<string | null>(null);

  /** Cached promise — ensures restoreSession runs only once at a time. */
  private _restorePromise: Promise<void> | null = null;

  readonly isAuthenticated = computed(() => this._isAuthenticated());
  readonly tenantId = computed(() => this._tenantId());
  readonly isManager = computed(() => this._groups().includes('managers'));
  readonly displayName = computed(() => this._displayName() || this._email() || null);
  readonly email = computed(() => this._email());

  /**
   * Per-tenant role derived from cognito:groups + custom:tenant_id.
   *
   * Mirrors `chalicelib/cognito_auth.py:extract_role` precedence (highest
   * privilege wins): manager > doctor > receptionist, with the legacy default
   * being `doctor` when no `tenant:<id>:<role>` group is found. Keeps
   * single-Cognito-user-per-tenant deployments (jh@vendia.vip,
   * jh@jhcontext.com) working without a Cognito migration.
   */
  readonly role = computed<'doctor' | 'receptionist' | 'manager'>(() => {
    const groups = this._groups();
    if (groups.includes('managers')) return 'manager';
    const tid = this._tenantId();
    if (tid) {
      if (groups.includes(`tenant:${tid}:doctor`)) return 'doctor';
      // `:secretary` is the legacy spelling of `:receptionist`, still read
      // during the rename migration.
      if (groups.includes(`tenant:${tid}:receptionist`)
          || groups.includes(`tenant:${tid}:secretary`)) return 'receptionist';
    }
    // Legacy default — pre-migration tenants with one Cognito user had
    // implicit doctor-equivalent full access.
    return 'doctor';
  });

  /** True when the current role is `doctor` or `manager` — write-action gate. */
  readonly canWriteAsDoctor = computed(() => {
    const r = this.role();
    return r === 'doctor' || r === 'manager';
  });

  /**
   * True when the caller holds the additive admin capability — a member of
   * `tenant:<id>:admin`, or a platform manager. Admin gates staff management
   * (invite / edit / remove staff, promote / revoke other admins). It is
   * orthogonal to `role` — an "admin doctor" is both.
   */
  readonly isAdmin = computed(() => {
    const groups = this._groups();
    if (groups.includes('managers')) return true;
    const tid = this._tenantId();
    return !!tid && groups.includes(`tenant:${tid}:admin`);
  });

  /** Resolves once the initial session restore has completed. */
  readonly ready: Promise<void>;

  constructor(private router: Router) {
    // Restore session on app start and expose the promise
    this.ready = this.restoreSession();
  }

  async restoreSession(): Promise<void> {
    // Deduplicate concurrent calls
    if (this._restorePromise) return this._restorePromise;
    this._restorePromise = this._doRestore();
    try {
      await this._restorePromise;
    } finally {
      this._restorePromise = null;
    }
  }

  private async _doRestore(): Promise<void> {
    try {
      await getCurrentUser();
      const session = await fetchAuthSession();
      const idToken = session.tokens?.idToken?.toString() ?? null;
      const payload = session.tokens?.idToken?.payload ?? {};
      const tenantId = (payload['custom:tenant_id'] as string) ?? null;
      const groups = (payload['cognito:groups'] as string[]) ?? [];
      const email = (payload['email'] as string) ?? null;
      const name = (payload['name'] as string)
        ?? (payload['given_name'] as string)
        ?? (payload['preferred_username'] as string)
        ?? null;

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

  /**
   * Return a fresh ID token, refreshing via Amplify if the cached one has expired.
   * Use this for any outbound API / WebSocket call.
   */
  async getFreshIdToken(): Promise<string | null> {
    try {
      const session = await fetchAuthSession();
      const idToken = session.tokens?.idToken?.toString() ?? null;
      if (idToken) this._idToken.set(idToken);
      return idToken;
    } catch {
      return this._idToken();
    }
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

  /**
   * Verify a Turnstile token at the backend and receive a short-lived nonce
   * bound to (action, origin). Throws when the captcha fails — callers should
   * surface the error and refuse to proceed with the Cognito call.
   */
  async precheckCaptcha(action: PrecheckAction, captchaToken: string): Promise<string> {
    const res = await firstValueFrom(
      this.http.post<PrecheckResponse>(`${environment.apiUrl}/auth/precheck`, {
        action,
        captcha_token: captchaToken,
      }),
    );
    return res.nonce;
  }

  /**
   * Request a password reset code via the backend-proxied Cognito ForgotPassword.
   * The backend enforces captcha server-side, so this call is bounded by the
   * captcha solve rate per origin.
   */
  async forgotPassword(email: string, captchaToken: string): Promise<void> {
    await firstValueFrom(
      this.http.post(`${environment.apiUrl}/auth/forgot-password`, {
        email,
        captcha_token: captchaToken,
      }),
    );
  }

  /** Submit the reset code + new password to Cognito ConfirmForgotPassword. */
  async confirmForgotPassword(
    email: string,
    code: string,
    password: string,
    captchaToken: string,
  ): Promise<void> {
    await firstValueFrom(
      this.http.post(`${environment.apiUrl}/auth/forgot-password-confirm`, {
        email,
        code,
        password,
        captcha_token: captchaToken,
      }),
    );
  }
}
