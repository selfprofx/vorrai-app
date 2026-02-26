import { Injectable, signal, WritableSignal } from '@angular/core';
import type { User } from '../../model/user';

/**
 * Mock implementation compatible with the signal-based UserService used in your component.
 * - Exposes users: WritableSignal<User[]>
 * - Exposes loading and error signals
 * - Methods: load(), getUserById(), upsertUser(), removeUserById()
 *
 * Use this during development by providing it in place of your real UserService:
 * { provide: UserService, useClass: UserServiceMock }
 */
@Injectable({
  providedIn: 'root',
})
export class UserServiceMock {
  // Signals used as the source of truth for the UI
  users: WritableSignal<User[]> = signal<User[]>(this._createInitialMockUsers());
  loading: WritableSignal<boolean> = signal(false);
  error: WritableSignal<string | null> = signal(null);

  // Simulated latency (ms)
  private readonly latency = 300;

  constructor() {
    // Optionally auto-load on creation (already have initial data, but this simulates a fetch)
    // this.load();
  }

  /**
   * Simulate loading from backend and replace the users signal after latency.
   */
  async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);

    try {
      await this._delay(this.latency);
      // In a real fetch we'd parse/validate. Here we simply keep initial users.
      this.users.set(this._createInitialMockUsers().slice());
    } catch (err: any) {
      this.error.set(err?.message ?? 'Mock load failed');
    } finally {
      this.loading.set(false);
    }
  }

  /**
   * Simulate fetching a single user by id.
   */
  async getUserById(id: string): Promise<User | undefined> {
    await this._delay(this.latency);
    return this.users().find((u) => u.id === id);
  }

  /**
   * Upsert user (simulate POST/PUT) with optimistic local update.
   */
  async upsertUser(user: User): Promise<void> {
    // optimistic local update
    const snapshot = this.users();
    const idx = snapshot.findIndex((u) => u.id === user.id);
    const next = snapshot.slice();

    if (idx >= 0) {
      next[idx] = { ...next[idx], ...user };
    } else {
      // ensure new user has at least an id
      next.unshift({ ...user });
    }
    this.users.set(next);

    // simulate network call
    try {
      await this._delay(this.latency);
      // success: do nothing (local state already updated)
    } catch (err: any) {
      // on "error" rollback (simple rollback to previous snapshot)
      this.users.set(snapshot);
      this.error.set(err?.message ?? 'Mock upsert failed');
    }
  }

  /**
   * Remove a user by id (simulate DELETE) with optimistic update.
   */
  async removeUserById(id: string): Promise<void> {
    const snapshot = this.users();
    this.users.set(snapshot.filter((u) => u.id !== id));

    try {
      await this._delay(this.latency);
      // success
    } catch (err: any) {
      // rollback
      this.users.set(snapshot);
      this.error.set(err?.message ?? 'Mock delete failed');
    }
  }

  /** Helper to simulate latency using Promise + setTimeout */
  private _delay(ms: number): Promise<void> {
    return new Promise((res) => setTimeout(res, ms));
  }

  /** Creates the same initial mock users you provided (kept ids as-is) */
  private _createInitialMockUsers(): User[] {
    return [
      {
        id: 'user-1',
        insta_id: 'wolfgogh',
        whats_id: null,
        tiktok_id: null,
        name: 'João Henrique',
        email: 'joao@example.com',
        phone: '+55-11-99999-0001',
        utm_persona: 'art-lover',
        umeta_summary: 'Completed spin: creative persona',
        chat_state: 'active',
        prev_chat_state: 'idle',
        chat_state_history: ['idle', 'onboarding', 'active'],
        has_meta: true 
      },
      {
        id: 'user-2',
        insta_id: null,
        whats_id: '+5511999888777',
        tiktok_id: 'tiktok_user2',
        name: 'Mariana Costa',
        email: 'mariana@example.com',
        phone: '+55-21-98888-7777',
        utm_persona: 'early-adopter',
        umeta_summary: null,
        chat_state: 'onboarding',
        prev_chat_state: 'visitor',
        chat_state_history: ['visitor', 'onboarding'],
        has_meta: false 
      },
      {
        id: 'user-9',
        insta_id: 'traveler_9',
        whats_id: null,
        tiktok_id: null,
        name: 'Carlos Silva',
        email: 'carlos.silva@sample.org',
        phone: null,
        utm_persona: null,
        umeta_summary: 'Basic profile',
        chat_state: 'idle',
        prev_chat_state: 'active',
        chat_state_history: ['active', 'idle'],
        has_meta: true 
      },
    ];
  }
}
