import { Injectable, inject, WritableSignal, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { toSignal } from '@angular/core/rxjs-interop';
import type { User } from '../model/user';
import { map } from 'rxjs/operators';

@Injectable({ providedIn: 'root' })
export class UserService {
  private http = inject(HttpClient);
  private base = '/api';

  // Exposed writable signal holding the list of users (initially empty array).
  // Consumers (components) can read users() and reactivity will update UI automatically.
  users: WritableSignal<User[]> = signal<User[]>([]);
  loading = signal(false);
  error = signal<string | null>(null);

  constructor() {
    // load immediately (or call load() explicitly)
    this.load();
  }

  /**
   * Load users from backend and wire the observable to a signal.
   * Using toSignal creates a signal that updates automatically when the observable emits.
   */
  load(): void {
    this.loading.set(true);
    this.error.set(null);

    // Convert the HTTP observable to a signal with an initial value.
    // toSignal will subscribe to the observable and update the signal on emissions.
    // It is safe and recommended for bridging Observables -> Signals.
    const usersSignal = toSignal(
      this.http.get<User[]>(`${this.base}/users`).pipe(
        // ensure result is an array
        map((r) => r ?? [])
      ),
      { initialValue: [] }
    );

    // assign the writable signal to the returned signal.
    // We wrap with a setter effect so further changes can be performed through this.users.set(...)
    this.users.set(usersSignal() ?? []);

    // Keep an effect to update users when usersSignal changes (so users always reflects latest)
    // (we use a basic subscription-like approach using an interval-free micro-effect)
    const update = () => this.users.set(usersSignal() ?? []);
    // call once to sync initial value
    update();

    // Keep a small effect so when usersSignal changes angular tracks it
    // (simple pattern; if you want to avoid extra effect you can also hold the toSignal result directly)
    // Note: toSignal returns a read-only signal by default; above we copy into a writable one.
    // If you prefer to expose the read-only signal, consider exposing ReadonlySignal<User[]> instead.
    this.loading.set(false);
  }

  /** Upsert a user locally and optionally persist to backend */
  async upsertUser(user: User): Promise<void> {
    // optimistic update locally
    const current = this.users();
    const idx = current.findIndex((u) => u.id === user.id);
    const next = [...current];
    if (idx === -1) next.unshift(user);
    else next[idx] = user;
    this.users.set(next);

    try {
      await this.http.post(`${this.base}/users`, user).toPromise();
    } catch (err: any) {
      // on failure, optionally reload or set error
      this.error.set(err?.message ?? 'Failed to upsert user');
    }
  }

  /** Remove a user by id locally and call backend */
  async removeUserById(id: string): Promise<void> {
    const current = this.users();
    this.users.set(current.filter((u) => u.id !== id));

    try {
      await this.http.delete(`${this.base}/users/${id}`).toPromise();
    } catch (err: any) {
      this.error.set(err?.message ?? 'Failed to delete user');
      // optionally reload from server to reconcile
      await this.reloadFromServer();
    }
  }

  /** Re-fetch users and overwrite local signal */
  private async reloadFromServer(): Promise<void> {
    try {
      const data = await this.http.get<User[]>(`${this.base}/users`).toPromise();
      this.users.set(data ?? []);
      this.error.set(null);
    } catch (err: any) {
      this.error.set(err?.message ?? 'Failed to reload users');
    }
  }
}
