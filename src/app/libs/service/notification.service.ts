import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { AppWsService } from './app-ws.service';
import { environment } from '../../../environments/environment';

export interface AppNotification {
  id: string;
  tenant_notification_id?: string;
  type: string;
  title: string;
  message: string;
  timestamp: string;
  created_at?: string;
  read: boolean;
  link?: string;
  meta?: Record<string, any>;
}

export interface NotificationPreferences {
  notif_leads: boolean;
  notif_chats: boolean;
  notif_content: boolean;
  notif_followups: boolean;
  notif_bookings: boolean;
  notif_sound: boolean;
  notif_desktop: boolean;
}

export interface BadgeCounts {
  leads: number;
  chats: number;
  content: number;
  followups: number;
  bookings: number;
}

const STORAGE_KEY = 'vendia_notifications';
const BADGE_STORAGE_KEY = 'vendia_badge_counts';
const MAX_NOTIFICATIONS = 50;
const API = environment.apiUrl;

/** Maps WS event type → badge category */
const TYPE_TO_CATEGORY: Record<string, keyof BadgeCounts> = {
  new_user: 'leads',
  chat_update: 'chats',
  content_job_done: 'content',
  template_generated: 'content',
  followup_sent: 'followups',
  sequence_pending: 'followups',
  sequence_approved: 'followups',
  episode_sent: 'followups',
  booking_created: 'bookings',
  booking_updated: 'bookings',
  calendar_sync: 'bookings',
};

/** Maps WS event type → default route link */
const TYPE_TO_LINK: Record<string, string> = {
  new_user: '/users',
  chat_update: '/chats',
  content_job_done: '/content-jobs',
  template_generated: '/email-templates',
  followup_sent: '/followups',
  sequence_pending: '/followups',
  sequence_approved: '/followups',
  episode_sent: '/followups',
  booking_created: '/bookings',
  booking_updated: '/bookings',
  calendar_sync: '/bookings',
};

const ALL_WS_EVENTS = Object.keys(TYPE_TO_CATEGORY);

const DEFAULT_PREFS: NotificationPreferences = {
  notif_leads: true,
  notif_chats: true,
  notif_content: true,
  notif_followups: true,
  notif_bookings: true,
  notif_sound: true,
  notif_desktop: false,
};

const EMPTY_BADGES: BadgeCounts = { leads: 0, chats: 0, content: 0, followups: 0, bookings: 0 };

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private http = inject(HttpClient);
  private appWs = inject(AppWsService);

  readonly notifications = signal<AppNotification[]>(this._loadFromStorage());
  readonly unreadCount = computed(() => this.notifications().filter(n => !n.read).length);
  readonly badgeCounts = signal<BadgeCounts>(this._loadBadgesFromStorage());
  readonly preferences = signal<NotificationPreferences>(DEFAULT_PREFS);
  readonly prefsLoading = signal(false);

  private _initialized = false;
  private _audioCtx: AudioContext | null = null;

  constructor() {
    // Subscribe to all notification-worthy WS events
    this.appWs.on(...ALL_WS_EVENTS).subscribe(msg => {
      this._handleWsEvent(msg);
    });
  }

  // ------------------------------------------------------------------
  // INITIALIZATION (call after auth is confirmed)
  // ------------------------------------------------------------------

  async init(): Promise<void> {
    if (this._initialized) return;
    this._initialized = true;
    await Promise.all([
      this.loadNotifications(),
      this.loadBadgeCounts(),
      this.loadPreferences(),
    ]);
  }

  // ------------------------------------------------------------------
  // NOTIFICATIONS CRUD
  // ------------------------------------------------------------------

  async loadNotifications(): Promise<void> {
    try {
      const res = await this.http
        .get<{ items: any[]; last_key?: string }>(`${API}/dashboard/notifications?limit=50`)
        .toPromise();
      const items = (res?.items ?? []).map(n => this._apiToLocal(n));
      this.notifications.set(items);
      this._saveToStorage(items);
    } catch {
      // Fall back to localStorage cache
    }
  }

  async markRead(notification: AppNotification): Promise<void> {
    // Optimistic update
    const updated = this.notifications().map(n =>
      n.id === notification.id ? { ...n, read: true } : n
    );
    this.notifications.set(updated);
    this._saveToStorage(updated);

    // Decrement badge
    const category = TYPE_TO_CATEGORY[notification.type];
    if (category) {
      this.badgeCounts.update(c => ({
        ...c,
        [category]: Math.max(0, c[category] - 1),
      }));
      this._saveBadgesToStorage(this.badgeCounts());
    }

    // API call
    if (notification.tenant_notification_id && notification.created_at) {
      try {
        await this.http.patch(
          `${API}/dashboard/notifications/${notification.id}/read`,
          { created_at: notification.created_at },
        ).toPromise();
      } catch { /* best-effort */ }
    }
  }

  async markAllRead(): Promise<void> {
    const updated = this.notifications().map(n => ({ ...n, read: true }));
    this.notifications.set(updated);
    this._saveToStorage(updated);
    this.badgeCounts.set({ ...EMPTY_BADGES });
    this._saveBadgesToStorage(this.badgeCounts());

    try {
      await this.http.patch(`${API}/dashboard/notifications/read-all`, {}).toPromise();
    } catch { /* best-effort */ }
  }

  // ------------------------------------------------------------------
  // BADGE COUNTS
  // ------------------------------------------------------------------

  async loadBadgeCounts(): Promise<void> {
    try {
      const counts = await this.http
        .get<BadgeCounts>(`${API}/dashboard/notifications/badge-counts`)
        .toPromise();
      if (counts) {
        this.badgeCounts.set(counts);
        this._saveBadgesToStorage(counts);
      }
    } catch { /* use cached */ }
  }

  clearBadgeForPage(category: keyof BadgeCounts): void {
    if (this.badgeCounts()[category] > 0) {
      this.badgeCounts.update(c => ({ ...c, [category]: 0 }));
      this._saveBadgesToStorage(this.badgeCounts());
    }
  }

  // ------------------------------------------------------------------
  // PREFERENCES
  // ------------------------------------------------------------------

  async loadPreferences(): Promise<void> {
    this.prefsLoading.set(true);
    try {
      const prefs = await this.http
        .get<NotificationPreferences>(`${API}/dashboard/notifications/settings`)
        .toPromise();
      if (prefs) this.preferences.set(prefs);
    } catch { /* use defaults */ }
    finally { this.prefsLoading.set(false); }
  }

  async savePreferences(prefs: NotificationPreferences): Promise<void> {
    this.prefsLoading.set(true);
    try {
      const saved = await this.http
        .put<NotificationPreferences>(`${API}/dashboard/notifications/settings`, prefs)
        .toPromise();
      if (saved) this.preferences.set(saved);
    } finally {
      this.prefsLoading.set(false);
    }
  }

  // ------------------------------------------------------------------
  // WS EVENT HANDLING
  // ------------------------------------------------------------------

  private _handleWsEvent(msg: Record<string, any>): void {
    const eventType = msg['type'] as string;
    const category = TYPE_TO_CATEGORY[eventType];
    if (!category) return;

    // Check preferences — skip if user disabled this category
    const prefs = this.preferences();
    const prefKey = `notif_${category}` as keyof NotificationPreferences;
    if (prefs[prefKey] === false) return;

    // Build notification from WS payload
    const notification: AppNotification = {
      id: msg['notification_id'] || crypto.randomUUID(),
      tenant_notification_id: msg['tenant_notification_id'],
      type: eventType,
      title: msg['title'] || this._defaultTitle(eventType, msg),
      message: msg['message'] || this._defaultMessage(eventType, msg),
      timestamp: new Date().toISOString(),
      created_at: msg['created_at'],
      read: false,
      link: msg['link'] || TYPE_TO_LINK[eventType],
      meta: msg,
    };

    // Prepend to list
    const updated = [notification, ...this.notifications()].slice(0, MAX_NOTIFICATIONS);
    this.notifications.set(updated);
    this._saveToStorage(updated);

    // Increment badge
    this.badgeCounts.update(c => ({
      ...c,
      [category]: c[category] + 1,
    }));
    this._saveBadgesToStorage(this.badgeCounts());

    // Sound
    if (prefs.notif_sound) this._playChime();

    // Desktop notification
    if (prefs.notif_desktop) this._showDesktopNotification(notification);
  }

  private _defaultTitle(type: string, msg: Record<string, any>): string {
    const label = msg['name'] || msg['full_name'] || msg['email'] || '';
    switch (type) {
      case 'new_user': return `New Lead: ${label}`;
      case 'chat_update': return `Chat Update: ${label}`;
      case 'content_job_done': return `Content Ready: ${msg['article_title'] || 'Untitled'}`;
      case 'template_generated': return 'Email Template Generated';
      case 'followup_sent': return `Followup Sent to ${label}`;
      case 'booking_created': return `New Booking: ${label}`;
      case 'booking_updated': return `Booking Updated: ${label}`;
      case 'sequence_pending': return `Sequence Awaiting Approval: ${label}`;
      case 'episode_sent': return `Episode Delivered to ${label}`;
      default: return type;
    }
  }

  private _defaultMessage(type: string, msg: Record<string, any>): string {
    const label = msg['name'] || msg['full_name'] || msg['email'] || 'Someone';
    switch (type) {
      case 'new_user': return `${label} submitted a form and verified their email.`;
      case 'chat_update': return `${label}'s conversation state changed.`;
      case 'content_job_done': return `Content job completed successfully.`;
      case 'followup_sent': return `A personalized followup email was sent to ${label}.`;
      case 'booking_created': return `${label} booked an appointment.`;
      case 'sequence_pending': return `A new email sequence for ${label} needs your review.`;
      default: return '';
    }
  }

  // ------------------------------------------------------------------
  // SOUND
  // ------------------------------------------------------------------

  private _playChime(): void {
    try {
      if (!this._audioCtx) this._audioCtx = new AudioContext();
      const ctx = this._audioCtx;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.setValueAtTime(1100, ctx.currentTime + 0.1);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.3);
    } catch { /* audio not available */ }
  }

  // ------------------------------------------------------------------
  // DESKTOP NOTIFICATIONS
  // ------------------------------------------------------------------

  private _showDesktopNotification(n: AppNotification): void {
    try {
      if (Notification.permission === 'granted') {
        new Notification(n.title, { body: n.message, icon: '/favicon.ico' });
      } else if (Notification.permission !== 'denied') {
        Notification.requestPermission();
      }
    } catch { /* not supported */ }
  }

  // ------------------------------------------------------------------
  // LOCAL STORAGE CACHE
  // ------------------------------------------------------------------

  private _apiToLocal(n: any): AppNotification {
    return {
      id: n.id || n.notification_id,
      tenant_notification_id: n.tenant_notification_id,
      type: n.type,
      title: n.title,
      message: n.message,
      timestamp: n.created_at || n.timestamp,
      created_at: n.created_at,
      read: !!n.read,
      link: n.link,
      meta: n.meta,
    };
  }

  private _loadFromStorage(): AppNotification[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  }

  private _saveToStorage(items: AppNotification[]): void {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(items)); }
    catch { /* quota exceeded */ }
  }

  private _loadBadgesFromStorage(): BadgeCounts {
    try {
      const raw = localStorage.getItem(BADGE_STORAGE_KEY);
      return raw ? JSON.parse(raw) : { ...EMPTY_BADGES };
    } catch { return { ...EMPTY_BADGES }; }
  }

  private _saveBadgesToStorage(counts: BadgeCounts): void {
    try { localStorage.setItem(BADGE_STORAGE_KEY, JSON.stringify(counts)); }
    catch { /* quota exceeded */ }
  }
}
