import { Injectable, inject, OnDestroy } from '@angular/core';
import { Subject, Observable, filter, map } from 'rxjs';
import { AuthService } from './auth.service';
import { environment } from '../../../../environments/environment';

export interface WsMessage {
  type: string;
  [key: string]: any;
}

const WSS_URL = environment.wssUrl;
const RECONNECT_DELAY_MS = 5000;

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

  connect(): void {
    if (!WSS_URL) return;
    const token = this.authService.getIdToken();
    if (!token) return;
    if (this.ws && this.ws.readyState === WebSocket.OPEN) return;

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
