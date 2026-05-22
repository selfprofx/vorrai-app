import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface CalendarStatus {
  provider: 'google' | 'microsoft' | 'local' | 'none';
  connected: boolean;
  mode: 'local' | 'synced';
  calendar_user_id: string;
}

export interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  description: string;
  location: string;
  status: string;
  provider: 'google' | 'microsoft' | 'local';
  html_link: string;
  event_type?: string;
  video_link?: string;
  user_name?: string;
  user_email?: string;
  user_id?: string;
  /** The doctor (clinic staff_id) this appointment belongs to, if any. */
  staff_id?: string;
  timezone?: string;
}

export interface CalendarEventsResponse {
  events: CalendarEvent[];
  provider: string;
  error?: string;
}

export interface CreateEventRequest {
  title: string;
  start: string;
  end: string;
  event_type?: string;
  notes?: string;
  location?: string;
  /** Bind a block/appointment to a specific doctor's calendar. */
  staff_id?: string;
}

export interface CreateEventResponse {
  event_id: string;
  title: string;
  start: string;
  end: string;
  status: string;
  sync_status: string;
}

@Injectable({ providedIn: 'root' })
export class BookingsService {
  private http = inject(HttpClient);
  private base = environment.apiUrl;

  getStatus(): Promise<CalendarStatus> {
    return firstValueFrom(
      this.http.get<CalendarStatus>(`${this.base}/calendar/status`)
    );
  }

  /** Fetch calendar events. Pass `staffId` to scope to one doctor's calendar
   *  (the per-doctor view); omit it for the whole-tenant calendar. */
  getEvents(timeMin?: string, timeMax?: string, staffId?: string): Promise<CalendarEventsResponse> {
    const params: Record<string, string> = {};
    if (timeMin) params['time_min'] = timeMin;
    if (timeMax) params['time_max'] = timeMax;
    if (staffId) params['staff_id'] = staffId;
    return firstValueFrom(
      this.http.get<CalendarEventsResponse>(`${this.base}/calendar/events`, { params })
    );
  }

  getConnectUrl(provider: 'google' | 'microsoft'): Promise<{ url: string }> {
    return firstValueFrom(
      this.http.get<{ url: string }>(`${this.base}/calendar/connect`, {
        params: { provider },
      })
    );
  }

  disconnect(): Promise<{ status: string }> {
    return firstValueFrom(
      this.http.delete<{ status: string }>(`${this.base}/calendar/disconnect`)
    );
  }

  createEvent(event: CreateEventRequest): Promise<CreateEventResponse> {
    return firstValueFrom(
      this.http.post<CreateEventResponse>(`${this.base}/calendar/events`, event)
    );
  }

  deleteEvent(eventId: string): Promise<{ status: string; event_id: string }> {
    return firstValueFrom(
      this.http.delete<{ status: string; event_id: string }>(`${this.base}/calendar/events/${eventId}`)
    );
  }

  /** Send a message to the in-app booking chat. The crew's reply arrives
   *  asynchronously over the dashboard WebSocket as a `booking_chat_response`
   *  event correlated by `request_id`. */
  sendBookingChat(payload: {
    message: string;
    doctor_id?: string;
    patient_name?: string;
    patient_email?: string;
    request_id?: string;
  }): Promise<{ queued: boolean; job_id: string; request_id: string }> {
    return firstValueFrom(
      this.http.post<{ queued: boolean; job_id: string; request_id: string }>(
        `${this.base}/dashboard/clinic/booking-chat`, payload,
      )
    );
  }
}
