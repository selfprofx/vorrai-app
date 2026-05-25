import { Component, OnInit, OnDestroy, inject, signal, computed } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { NbCardModule, NbIconModule, NbBadgeModule } from '@nebular/theme';
import { TranslatePipe } from '@ngx-translate/core';
import { Subscription } from 'rxjs';

import { AppWsService } from '../../libs/service/app-ws.service';

/**
 * Real-time view of the waitlist cancel-backfill cascade.
 *
 * Listens to the dashboard websocket for offer-cycle events and shows three
 * lists side by side: pending offers (with an expiry countdown), recent
 * swaps (vacated slot → filled slot), and unfilled slots whose cascade ran
 * dry (queue exhausted or depth cap hit). Each row is self-explanatory so
 * the doctor + receptionist can glance at the panel between consults and
 * know whether the day's churn is being absorbed.
 *
 * Mount anywhere in the clinical-vertical dashboard. The component is
 * memory-light: it holds at most ~15 rows per bucket and self-prunes when
 * an offer resolves.
 */
interface PendingOffer {
  offerId: string;
  freedEventId: string;
  userId?: string;
  userName?: string;
  cascadeDepth: number;
  expiresAt: string;
  sentAt: string;
}

interface RecentSwap {
  offerId: string;
  freedEventId: string;
  vacatedEventId?: string;
  userId?: string;
  userName?: string;
  at: string;
}

interface UnfilledSlot {
  freedEventId: string;
  reason: string;   // "queue_exhausted" | "cascade_depth_exceeded"
  at: string;
}

const MAX_ROWS_PER_BUCKET = 15;


@Component({
  selector: 'app-waitlist-activity',
  standalone: true,
  imports: [CommonModule, NbCardModule, NbIconModule, NbBadgeModule, DatePipe, TranslatePipe],
  templateUrl: './waitlist-activity.html',
  styleUrl: './waitlist-activity.scss',
})
export class WaitlistActivityComponent implements OnInit, OnDestroy {
  private appWs = inject(AppWsService);
  private wsSub?: Subscription;

  pendingOffers = signal<PendingOffer[]>([]);
  recentSwaps = signal<RecentSwap[]>([]);
  unfilledSlots = signal<UnfilledSlot[]>([]);

  // Recompute every second to drive the expiry countdown without a separate
  // signal — `nowMs` ticks via setInterval; the template binds to it via
  // `secondsUntil`.
  private nowMs = signal(Date.now());
  private clockInterval?: ReturnType<typeof setInterval>;

  hasActivity = computed(() =>
    this.pendingOffers().length > 0 ||
    this.recentSwaps().length > 0 ||
    this.unfilledSlots().length > 0,
  );

  ngOnInit(): void {
    this.appWs.ensureConnected();
    this.wsSub = this.appWs.on(
      'waitlist_offer_sent',
      'waitlist_offer_expired',
      'waitlist_offer_confirmed',
      'event_swapped',
      'slot_remains_open',
    ).subscribe((msg) => this.handleEvent(msg));

    this.clockInterval = setInterval(() => this.nowMs.set(Date.now()), 1000);
  }

  ngOnDestroy(): void {
    this.wsSub?.unsubscribe();
    if (this.clockInterval) clearInterval(this.clockInterval);
  }

  /** Seconds until `expiresAt`, clamped to 0. Used for the countdown badge. */
  secondsUntil(expiresAt: string): number {
    const target = Date.parse(expiresAt);
    if (Number.isNaN(target)) return 0;
    return Math.max(0, Math.floor((target - this.nowMs()) / 1000));
  }

  /** Format a seconds count as `Mm:SSs` for the badge. */
  formatCountdown(secs: number): string {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}m ${s.toString().padStart(2, '0')}s`;
  }

  // ────────────────────────────────────────────────────────────────────

  private handleEvent(msg: any): void {
    switch (msg.type) {
      case 'waitlist_offer_sent':
        this.upsertPending({
          offerId: msg.offer_id,
          freedEventId: msg.freed_event_id,
          userId: msg.user_id,
          userName: msg.user_name,
          cascadeDepth: msg.cascade_depth ?? 0,
          expiresAt: msg.expires_at,
          sentAt: new Date().toISOString(),
        });
        break;
      case 'waitlist_offer_expired':
      case 'waitlist_offer_confirmed':
        this.removePending(msg.offer_id);
        break;
      case 'event_swapped':
        this.removePending(msg.offer_id);
        this.prependSwap({
          offerId: msg.offer_id,
          freedEventId: msg.freed_event_id,
          vacatedEventId: msg.vacated_event_id,
          userId: msg.user_id,
          userName: msg.user_name,
          at: new Date().toISOString(),
        });
        break;
      case 'slot_remains_open':
        this.prependUnfilled({
          freedEventId: msg.freed_event_id,
          reason: msg.reason || 'unknown',
          at: new Date().toISOString(),
        });
        break;
    }
  }

  private upsertPending(offer: PendingOffer): void {
    const next = this.pendingOffers().filter(o => o.offerId !== offer.offerId);
    next.unshift(offer);
    this.pendingOffers.set(next.slice(0, MAX_ROWS_PER_BUCKET));
  }

  private removePending(offerId: string): void {
    this.pendingOffers.set(this.pendingOffers().filter(o => o.offerId !== offerId));
  }

  private prependSwap(swap: RecentSwap): void {
    const next = [swap, ...this.recentSwaps()].slice(0, MAX_ROWS_PER_BUCKET);
    this.recentSwaps.set(next);
  }

  private prependUnfilled(slot: UnfilledSlot): void {
    const next = [slot, ...this.unfilledSlots()].slice(0, MAX_ROWS_PER_BUCKET);
    this.unfilledSlots.set(next);
  }
}
