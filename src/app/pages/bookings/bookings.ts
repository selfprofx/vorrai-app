import { Component, OnInit, OnDestroy, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { FullCalendarModule } from '@fullcalendar/angular';
import { CalendarOptions, EventInput } from '@fullcalendar/core';
import dayGridPlugin from '@fullcalendar/daygrid';
import listPlugin from '@fullcalendar/list';
import interactionPlugin from '@fullcalendar/interaction';
import { NbCardModule, NbButtonModule, NbSpinnerModule, NbToastrService, NbIconModule, NbDialogService, NbInputModule } from '@nebular/theme';
import { FormsModule } from '@angular/forms';
import { BookingsService, CalendarStatus, CalendarEvent } from '../../libs/service/bookings.service';
import { AppWsService } from '../../libs/service/app-ws.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'bookings',
  imports: [
    CommonModule,
    FormsModule,
    FullCalendarModule,
    NbCardModule,
    NbButtonModule,
    NbSpinnerModule,
    NbIconModule,
    NbInputModule,
  ],
  templateUrl: './bookings.html',
  styleUrl: './bookings.scss',
})
export class Bookings implements OnInit, OnDestroy {
  private bookingsService = inject(BookingsService);
  private toastr          = inject(NbToastrService);
  private appWs           = inject(AppWsService);
  private route           = inject(ActivatedRoute);

  private wsSub?: Subscription;

  status        = signal<CalendarStatus | null>(null);
  loadingStatus = signal(true);
  loadingEvents = signal(false);
  syncing       = signal(false);
  connecting    = signal<'google' | 'microsoft' | null>(null);
  disconnecting = signal(false);
  events        = signal<CalendarEvent[]>([]);
  error         = signal<string | null>(null);
  wsConnected   = signal(false);

  // Block time form
  showBlockForm  = signal(false);
  blockTitle     = '';
  blockDate      = '';
  blockStartTime = '09:00';
  blockEndTime   = '10:00';
  creatingBlock  = signal(false);

  calendarOptions = signal<CalendarOptions>({
    initialView: 'dayGridMonth',
    plugins: [dayGridPlugin, listPlugin, interactionPlugin],
    headerToolbar: {
      left:   'prev,next today',
      center: 'title',
      right:  'dayGridMonth,listMonth',
    },
    height: 'auto',
    events: [],
    eventClick: (info) => {
      const extProps = info.event.extendedProps;
      if (extProps['html_link']) {
        window.open(extProps['html_link'], '_blank');
      }
    },
  });

  readonly providerLabel: Record<string, string> = {
    google:    'Google Calendar',
    microsoft: 'Microsoft Calendar',
    local:     'Local Calendar',
    none:      'Local Calendar',
  };

  readonly EVENT_COLORS: Record<string, { bg: string; border: string }> = {
    local:     { bg: '#34A853', border: '#2d8f47' },
    google:    { bg: '#4285F4', border: '#2b5fbb' },
    microsoft: { bg: '#0078D4', border: '#005a9e' },
  };

  async ngOnInit() {
    // Handle OAuth callback query params
    this.route.queryParams.subscribe(params => {
      if (params['calendar_connected']) {
        const provider = params['calendar_connected'];
        this.toastr.success(`${this.providerLabel[provider] ?? provider} connected!`, 'Calendar Connected');
      }
      if (params['calendar_error']) {
        this.toastr.danger(`Calendar connection failed: ${params['calendar_error']}`, 'Connection Error');
      }
    });

    await this.loadStatus();

    // Subscribe to the global AppWsService for booking events
    this.appWs.connect();
    this.wsSub = this.appWs.on(
      'booking_created', 'booking_updated', 'calendar_sync', 'message', 'ws_connected', 'ws_disconnected',
    ).subscribe(data => {
      if (data.type === 'ws_connected') { this.wsConnected.set(true); return; }
      if (data.type === 'ws_disconnected') { this.wsConnected.set(false); return; }
      this.handleWsMessage(data);
    });
  }

  ngOnDestroy() {
    this.wsSub?.unsubscribe();
  }

  private handleWsMessage(data: any) {
    const type: string = data.type ?? '';

    if (type === 'booking_created' || type === 'booking_updated' || type === 'calendar_sync') {
      this.toastr.info('New booking received — refreshing calendar.', 'Live Update');
      this.loadEvents();
      return;
    }

    if (type === 'message' && data.text) {
      const lower: string = (data.text as string).toLowerCase();
      if (lower.includes('booking') || lower.includes('schedule') || lower.includes('appointment')) {
        this.toastr.info('Schedule update detected — refreshing.', 'Live Update');
        this.loadEvents();
      }
    }
  }

  // ── Status + Events ──────────────────────────────────────────────────────

  async loadStatus() {
    this.loadingStatus.set(true);
    this.error.set(null);
    try {
      const s = await this.bookingsService.getStatus();
      this.status.set(s);
      // Always load events — local calendar always has events
      await this.loadEvents();
    } catch (e: any) {
      this.error.set(e?.error?.message || 'Could not load calendar status.');
    } finally {
      this.loadingStatus.set(false);
    }
  }

  async loadEvents() {
    this.loadingEvents.set(true);
    try {
      const res = await this.bookingsService.getEvents();
      this.events.set(res.events);
      this.calendarOptions.update(opts => ({
        ...opts,
        events: this.toCalendarEvents(res.events),
      }));
    } catch (e: any) {
      this.toastr.warning('Could not load calendar events.', 'Warning');
    } finally {
      this.loadingEvents.set(false);
    }
  }

  async sync() {
    this.syncing.set(true);
    try {
      await this.loadEvents();
      this.toastr.success('Calendar synced.', 'Synced');
    } finally {
      this.syncing.set(false);
    }
  }

  async connectCalendar(provider: 'google' | 'microsoft') {
    this.connecting.set(provider);
    try {
      const { url } = await this.bookingsService.getConnectUrl(provider);
      window.location.href = url;
    } catch (e: any) {
      this.toastr.danger(e?.error?.message || 'Could not initiate connection.', 'Error');
      this.connecting.set(null);
    }
  }

  async disconnect() {
    this.disconnecting.set(true);
    try {
      await this.bookingsService.disconnect();
      this.status.set({ provider: 'local', connected: false, mode: 'local', calendar_user_id: '' });
      // Reload events — local events still exist
      await this.loadEvents();
      this.toastr.success('Calendar disconnected. Local events preserved.', 'Disconnected');
    } catch (e: any) {
      this.toastr.danger(e?.error?.message || 'Could not disconnect.', 'Error');
    } finally {
      this.disconnecting.set(false);
    }
  }

  // ── Block time ──────────────────────────────────────────────────────────

  toggleBlockForm() {
    this.showBlockForm.update(v => !v);
    if (this.showBlockForm()) {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      this.blockDate = tomorrow.toISOString().split('T')[0];
      this.blockTitle = 'Blocked Time';
    }
  }

  async createBlockedTime() {
    if (!this.blockDate || !this.blockStartTime || !this.blockEndTime) {
      this.toastr.warning('Please fill all fields.', 'Missing fields');
      return;
    }

    this.creatingBlock.set(true);
    try {
      await this.bookingsService.createEvent({
        title: this.blockTitle || 'Blocked Time',
        start: `${this.blockDate}T${this.blockStartTime}:00`,
        end: `${this.blockDate}T${this.blockEndTime}:00`,
        event_type: 'blocked',
      });
      this.toastr.success('Time blocked successfully.', 'Created');
      this.showBlockForm.set(false);
      await this.loadEvents();
    } catch (e: any) {
      this.toastr.danger(e?.error?.message || 'Could not block time.', 'Error');
    } finally {
      this.creatingBlock.set(false);
    }
  }

  // ── Helpers ─────────────────────────────────────────────────────────────

  private toCalendarEvents(events: CalendarEvent[]): EventInput[] {
    return events.map(ev => {
      const colors = this.EVENT_COLORS[ev.provider] || this.EVENT_COLORS['local'];
      return {
        id:    ev.id,
        title: ev.title,
        start: ev.start,
        end:   ev.end,
        extendedProps: {
          description: ev.description,
          location:    ev.location,
          status:      ev.status,
          provider:    ev.provider,
          html_link:   ev.html_link,
          event_type:  ev.event_type,
          video_link:  ev.video_link,
          user_name:   ev.user_name,
          user_email:  ev.user_email,
        },
        backgroundColor: colors.bg,
        borderColor:     colors.border,
      };
    });
  }
}
