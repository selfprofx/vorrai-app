import { Injectable, inject, OnDestroy } from '@angular/core';
import { Subject, Observable, filter, map, firstValueFrom, timeout } from 'rxjs';
import { AuthService } from './auth.service';
import { environment } from '../../../environments/environment';

export interface WsMessage {
  type: string;
  [key: string]: any;
}

const WSS_URL = environment.wssUrl;
const RECONNECT_DELAY_MS = 5000;

/**
 * Clinical-vertical event aliases — maps clinical names to the underlying
 * wire-event names emitted by the backend. Used by `onClinical()` so
 * clinical pages can subscribe to `new_patient` / `appointment_created`
 * etc. without the backend needing a parallel event vocabulary.
 */
const CLINICAL_TO_WIRE: Record<string, string> = {
  new_patient:             'new_user',
  consult_chat_update:     'chat_update',
  appointment_created:     'booking_created',
  appointment_updated:     'booking_updated',
  clinic_post_published:   'content_job_done',
  recall_pending_approval: 'sequence_pending',
  reminder_sent:           'episode_sent',
};

/**
 * Global dashboard WebSocket service.
 *
 * Connects once per authenticated session using the Cognito ID token as
 * ?dashboard_token=<jwt>.  All pages/components subscribe to the typed
 * message stream instead of managing their own WebSocket connections.
 *
 * Message types emitted by the backend:
 *   welcome       — connection established
 *   new_user      — a user verified their email (landing flow)
 *   chat_update   — a user's SPIN state changed
 *   booking_created / booking_updated / calendar_sync — calendar events
 *   followup_sent — a followup email was dispatched
 *
 * Vorrai Clinical (clinical-vertical tenants only):
 *   pretriage_complete       — pre-triage AI summary persisted; "Pre-Triage Ready" badge
 *   pretriage_requires_human — emergency or declined-consent escalation
 */
@Injectable({ providedIn: 'root' })
export class AppWsService implements OnDestroy {
  private authService = inject(AuthService);

  private ws: WebSocket | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private _connected = false;

  private readonly _messages$ = new Subject<WsMessage>();

  /** All raw WebSocket messages as an Observable. */
  readonly messages$: Observable<WsMessage> = this._messages$.asObservable();

  /** Filter messages by one or more type strings. */
  on(...types: string[]): Observable<WsMessage> {
    return this.messages$.pipe(filter(m => types.includes(m.type)));
  }

  /**
   * Clinical-vocabulary aliases over the same wire events. Backend stays
   * compatible (event names on the wire are unchanged); clinical-vertical
   * pages bind to the cleaner names without backend coupling.
   *
   *   new_patient            ← new_user
   *   consult_chat_update    ← chat_update
   *   appointment_created    ← booking_created
   *   appointment_updated    ← booking_updated
   *   clinic_post_published  ← content_job_done
   *   recall_pending_approval← sequence_pending
   *   reminder_sent          ← episode_sent
   *
   * Use exactly like `on()` — pass any combination of wire-name or alias
   * strings; both resolve to the same underlying event.
   */
  onClinical(...types: string[]): Observable<WsMessage> {
    const wireTypes = types.map(t => CLINICAL_TO_WIRE[t] ?? t);
    return this.messages$.pipe(filter(m => wireTypes.includes(m.type)));
  }

  async connect(): Promise<void> {
    if (!WSS_URL) return;
    const token = await this.authService.getFreshIdToken();
    if (!token) return;
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) return;

    const url = `${WSS_URL}?dashboard_token=${encodeURIComponent(token)}`;
    this.ws = new WebSocket(url);

    this.ws.onopen = () => {
      this._connected = true;
      this._messages$.next({ type: 'ws_connected' });
    };

    this.ws.onmessage = (evt) => {
      try {
        const data = JSON.parse(evt.data) as WsMessage;
        this._messages$.next(data);
      } catch { /* ignore non-JSON frames */ }
    };

    this.ws.onclose = () => {
      this._connected = false;
      this._messages$.next({ type: 'ws_disconnected' });
      this._scheduleReconnect();
    };

    this.ws.onerror = () => {
      this.ws?.close();
    };
  }

  /** Connect if not already open, and wait until the connection is established. */
  async ensureConnected(): Promise<void> {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) return;
    await this.connect();
    if (this._connected) return;
    await firstValueFrom(
      this._messages$.pipe(
        filter(m => m.type === 'ws_connected'),
        timeout(8_000),
      ),
    ).catch(() => {});
  }

  send(data: Record<string, any>): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  disconnect(): void {
    this._clearReconnectTimer();
    this.ws?.close();
    this.ws = null;
    this._connected = false;
  }

  get isConnected(): boolean {
    return this._connected;
  }

  private _scheduleReconnect(): void {
    this._clearReconnectTimer();
    this.reconnectTimer = setTimeout(() => {
      if (this.authService.isAuthenticated()) {
        this.connect();
      }
    }, RECONNECT_DELAY_MS);
  }

  private _clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  ngOnDestroy(): void {
    this.disconnect();
    this._messages$.complete();
  }
}
