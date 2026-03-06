import { Injectable, inject, signal, computed } from '@angular/core';
import { AppWsService } from './app-ws.service';

export interface AppNotification {
  id: string;
  type: string;
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
}

const STORAGE_KEY = 'vendia_notifications';
const MAX_NOTIFICATIONS = 50;

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private appWs = inject(AppWsService);

  readonly notifications = signal<AppNotification[]>(this._loadFromStorage());
  readonly unreadCount = computed(() => this.notifications().filter(n => !n.read).length);

  constructor() {
    this.appWs.on('content_job_done').subscribe(msg => {
      this.add({
        type: 'content_job_done',
        title: 'Content Ready',
        message: msg['article_title']
          ? `"${msg['article_title']}" has been generated.`
          : `Content job ${msg['job_id'] ?? ''} completed.`,
      });
    });
  }

  add(partial: Pick<AppNotification, 'type' | 'title' | 'message'>): void {
    const notification: AppNotification = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      read: false,
      ...partial,
    };
    const updated = [notification, ...this.notifications()].slice(0, MAX_NOTIFICATIONS);
    this.notifications.set(updated);
    this._saveToStorage(updated);
  }

  markAllRead(): void {
    const updated = this.notifications().map(n => ({ ...n, read: true }));
    this.notifications.set(updated);
    this._saveToStorage(updated);
  }

  clear(): void {
    this.notifications.set([]);
    this._saveToStorage([]);
  }

  private _loadFromStorage(): AppNotification[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  private _saveToStorage(items: AppNotification[]): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch { /* quota exceeded — ignore */ }
  }
}
