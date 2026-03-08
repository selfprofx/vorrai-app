import { Injectable, inject, signal, WritableSignal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import type { User, UserExpandDetail } from '../model/user';
import type { ConversationPreview } from '../model/conversation';
import { AuthService } from './auth.service';
import { AppWsService } from './app-ws.service';
import { environment } from '../../../environments/environment';

const API = environment.apiUrl;

@Injectable({ providedIn: 'root' })
export class UserService {
  private http        = inject(HttpClient);
  private authService = inject(AuthService);
  private appWs       = inject(AppWsService);

  readonly users:   WritableSignal<User[]>        = signal([]);
  readonly loading: WritableSignal<boolean>        = signal(false);
  readonly error:   WritableSignal<string | null> = signal(null);

  constructor() {
    // Wait for auth session to be restored before loading
    this.waitForAuthAndLoad();
    // Reload the users list whenever a new user verifies or a chat state changes
    this.appWs.on('new_user', 'chat_update').subscribe(() => this.load());
  }

  private async waitForAuthAndLoad(): Promise<void> {
    // Wait for the initial session restore to complete (deduped — no double call)
    await this.authService.ready;
    if (this.authService.isAuthenticated()) {
      await this.load();
    }
  }

  async load(): Promise<void> {
    // Skip if no auth token is available
    if (!this.authService.getIdToken()) return;

    this.loading.set(true);
    this.error.set(null);
    try {
      const res = await firstValueFrom(
        this.http.get<{ items: User[]; count: number }>(
          `${API}/dashboard/users`,
        ),
      );
      this.users.set(res.items ?? []);
    } catch (err: any) {
      this.error.set(err?.error?.message ?? err?.message ?? 'Failed to load users');
    } finally {
      this.loading.set(false);
    }
  }

  async getUser(userId: string): Promise<User | null> {
    try {
      return await firstValueFrom(
        this.http.get<User>(
          `${API}/dashboard/users/${userId}`,
        ),
      );
    } catch {
      return null;
    }
  }

  async getChatHistory(userId: string): Promise<any[]> {
    try {
      const res = await firstValueFrom(
        this.http.get<{ messages: any[]; count: number }>(
          `${API}/dashboard/users/${userId}/chat`,
        ),
      );
      return res.messages ?? [];
    } catch {
      return [];
    }
  }

  async getConversations(cursor?: string): Promise<{ items: ConversationPreview[]; next_cursor?: string }> {
    const params = cursor ? `?cursor=${encodeURIComponent(cursor)}` : '';
    const res = await firstValueFrom(
      this.http.get<{ items: ConversationPreview[]; next_cursor?: string }>(
        `${API}/dashboard/conversations${params}`,
      ),
    );
    return { items: res.items ?? [], next_cursor: res.next_cursor };
  }

  async getUserDetail(userId: string): Promise<UserExpandDetail | null> {
    try {
      return await firstValueFrom(
        this.http.get<UserExpandDetail>(
          `${API}/dashboard/users/${userId}/detail`,
        ),
      );
    } catch {
      return null;
    }
  }

  async upsertUser(user: User): Promise<void> {
    const current = this.users();
    const idx = current.findIndex(u => u.id === user.id);
    const next = [...current];
    if (idx === -1) next.unshift(user);
    else next[idx] = user;
    this.users.set(next);
  }

  async removeUserById(id: string): Promise<void> {
    this.users.set(this.users().filter(u => u.id !== id));
  }
}
