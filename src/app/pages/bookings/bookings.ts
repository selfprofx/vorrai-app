import { Component, OnInit, OnDestroy, signal, inject, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { FullCalendarModule } from '@fullcalendar/angular';
import { CalendarOptions, EventInput } from '@fullcalendar/core';
import dayGridPlugin from '@fullcalendar/daygrid';
import listPlugin from '@fullcalendar/list';
import interactionPlugin from '@fullcalendar/interaction';
import ptBrLocale from '@fullcalendar/core/locales/pt-br';
import esLocale from '@fullcalendar/core/locales/es';
import { NbCardModule, NbButtonModule, NbSpinnerModule, NbToastrService, NbIconModule, NbDialogService, NbInputModule, NbSelectModule } from '@nebular/theme';
import { FormsModule } from '@angular/forms';
import { BookingsService, CalendarStatus, CalendarEvent } from '../../libs/service/bookings.service';
import { ClinicStaffService, ClinicStaff } from '../../libs/service/clinic-staff.service';
import { AuthService } from '../../libs/service/auth.service';
import { AppWsService } from '../../libs/service/app-ws.service';
import { LabelService } from '../../core/label.service';
import { LocaleService, type SupportedLocale } from '../../core/locale.service';
import { Subscription } from 'rxjs';

const FULLCALENDAR_LOCALES: Record<SupportedLocale, unknown> = {
  'en': 'en',
  'pt-BR': ptBrLocale,
  'es': esLocale,
};

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
    NbSelectModule,
  ],
  templateUrl: './bookings.html',
  styleUrl: './bookings.scss',
})
export class Bookings implements OnInit, OnDestroy {
  private bookingsService = inject(BookingsService);
  private staffSvc        = inject(ClinicStaffService);
  private auth            = inject(AuthService);
  private toastr          = inject(NbToastrService);
  private appWs           = inject(AppWsService);
  private route           = inject(ActivatedRoute);
  private router          = inject(Router);
  protected labels        = inject(LabelService).labels;
  private localeService   = inject(LocaleService);

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

  // Per-doctor calendar — the selector lists the clinic's doctors with the
  // current user's own calendar first; '' means the whole-clinic view.
  doctors          = signal<ClinicStaff[]>([]);
  selectedDoctorId = signal<string>('');

  // Event detail dialog
  readonly localTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  showEventDialog = signal(false);
  selectedEvent   = signal<{
    title: string;
    user_name: string;
    user_email: string;
    user_id: string;
    timezone: string;
    start: string;
    end: string;
    event_type: string;
    location: string;
    description: string;
    video_link: string;
  } | null>(null);

  // Block time form
  showBlockForm  = signal(false);
  blockTitle     = '';
  blockDate      = '';
  blockStartTime = '09:00';
  blockEndTime   = '10:00';
  creatingBlock  = signal(false);

  // In-app booking chat — a receptionist books / reschedules on a patient's
  // behalf by chatting with Vorrai. The selected doctor (calendar selector)
  // scopes the booking; the crew's reply arrives over the WebSocket.
  showBookingChat    = signal(false);
  bookingChatMsgs    = signal<{ role: 'staff' | 'assistant'; text: string }[]>([]);
  bookingChatInput   = '';
  bookingChatPatient = '';
  bookingChatSending = signal(false);
  private bookingChatReqId = '';

  calendarOptions = signal<CalendarOptions>({
    initialView: 'dayGridMonth',
    plugins: [dayGridPlugin, listPlugin, interactionPlugin],
    locale: FULLCALENDAR_LOCALES[this.localeService.current()] as never,
    headerToolbar: {
      left:   'prev,next today',
      center: 'title',
      right:  'dayGridMonth,listMonth',
    },
    height: 'auto',
    events: [],
    eventClick: (info) => {
      const extProps = info.event.extendedProps;
      if (extProps['event_type'] === 'consultation' && extProps['user_id']) {
        this.selectedEvent.set({
          title:       info.event.title,
          user_name:   extProps['user_name'] || '',
          user_email:  extProps['user_email'] || '',
          user_id:     extProps['user_id'],
          timezone:    extProps['timezone'] || '',
          start:       info.event.startStr,
          end:         info.event.endStr || '',
          event_type:  extProps['event_type'],
          location:    extProps['location'] || '',
          description: extProps['description'] || '',
          video_link:  extProps['video_link'] || '',
        });
        this.showEventDialog.set(true);
        return;
      }
      if (extProps['html_link']) {
        window.open(extProps['html_link'], '_blank');
      }
    },
  });

  // Re-apply FullCalendar locale whenever the UI locale flips.
  private _calendarLocaleEffect = effect(() => {
    const code = this.localeService.current();
    this.calendarOptions.update(opts => ({
      ...opts,
      locale: FULLCALENDAR_LOCALES[code] as never,
    }));
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

    await this.loadDoctors();
    await this.loadStatus();

    // Subscribe to the global AppWsService for booking events
    this.appWs.connect();
    this.wsSub = this.appWs.on(
      'booking_created', 'booking_updated', 'calendar_sync', 'booking_chat_response',
      'message', 'ws_connected', 'ws_disconnected',
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

    if (type === 'booking_chat_response') {
      // Only surface the reply to the request this page sent.
      if (data.request_id && this.bookingChatReqId && data.request_id !== this.bookingChatReqId) {
        return;
      }
      this.bookingChatSending.set(false);
      this.bookingChatMsgs.update(m => [...m, {
        role: 'assistant' as const,
        text: data.text || '(no response)',
      }]);
      this.scrollBookingChat();
      this.loadEvents();  // a booking may have just been created
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
      const res = await this.bookingsService.getEvents(
        undefined, undefined, this.selectedDoctorId() || undefined,
      );
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

  /** Load the clinic's doctors for the calendar selector, ordering the current
   *  user's own calendar first so an admin doctor lands on their own schedule. */
  async loadDoctors() {
    try {
      const res = await this.staffSvc.list({ role: 'doctor' });
      const myEmail = (this.auth.email() || '').toLowerCase();
      const own = res.items.filter(d => (d.email || '').toLowerCase() === myEmail);
      const rest = res.items.filter(d => (d.email || '').toLowerCase() !== myEmail);
      const ordered = [...own, ...rest];
      this.doctors.set(ordered);
      // Default to the current user's own calendar when they are a doctor.
      if (own.length > 0) {
        this.selectedDoctorId.set(own[0].staff_id);
      }
    } catch {
      // Non-clinical tenants / no staff endpoint — fall back to the whole-clinic view.
      this.doctors.set([]);
    }
  }

  /** Doctor-selector change → reload the calendar scoped to that doctor. */
  onDoctorChange(staffId: string) {
    this.selectedDoctorId.set(staffId || '');
    this.loadEvents();
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

  // ── Booking chat ────────────────────────────────────────────────────────

  toggleBookingChat() {
    this.showBookingChat.update(v => !v);
  }

  /** Start a fresh booking conversation. */
  clearBookingChat() {
    this.bookingChatMsgs.set([]);
    this.bookingChatInput = '';
    this.bookingChatReqId = '';
  }

  /** Keep the chat thread pinned to the latest message. */
  private scrollBookingChat() {
    setTimeout(() => {
      const el = document.querySelector('.booking-chat-thread');
      if (el) el.scrollTop = el.scrollHeight;
    }, 0);
  }

  /** Doctor the booking chat will book for — the calendar selector's choice. */
  bookingChatDoctorName(): string {
    const id = this.selectedDoctorId();
    if (!id) return 'any doctor';
    return this.doctors().find(d => d.staff_id === id)?.name || 'the selected doctor';
  }

  async sendBookingChat() {
    const text = this.bookingChatInput.trim();
    if (!text || this.bookingChatSending()) return;

    this.bookingChatMsgs.update(m => [...m, { role: 'staff' as const, text }]);
    this.bookingChatInput = '';
    this.bookingChatSending.set(true);
    this.scrollBookingChat();
    const requestId = `bc-${Date.now()}`;
    this.bookingChatReqId = requestId;

    try {
      await this.bookingsService.sendBookingChat({
        message: text,
        doctor_id: this.selectedDoctorId() || undefined,
        patient_name: this.bookingChatPatient.trim() || undefined,
        request_id: requestId,
      });
    } catch (e: any) {
      this.bookingChatSending.set(false);
      this.bookingChatMsgs.update(m => [...m, {
        role: 'assistant' as const,
        text: 'Sorry — could not send that. Please try again.',
      }]);
      this.toastr.danger(
        e?.error?.Message || e?.message || 'Booking chat failed', 'Error',
      );
    }
  }

  // ── Event dialog ────────────────────────────────────────────────────────

  closeDialog() {
    this.showEventDialog.set(false);
    this.selectedEvent.set(null);
  }

  viewLead() {
    const ev = this.selectedEvent();
    if (ev?.user_id) {
      this.closeDialog();
      this.router.navigate(['/pages/user-chat', ev.user_id]);
    }
  }

  formatInTimezone(utcDate: string, tz: string): string {
    if (!utcDate) return '';
    try {
      const date = new Date(utcDate);
      return new Intl.DateTimeFormat('default', {
        timeZone: tz,
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(date);
    } catch {
      return utcDate;
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
          user_id:     ev.user_id,
          timezone:    ev.timezone,
        },
        backgroundColor: colors.bg,
        borderColor:     colors.border,
      };
    });
  }
}
