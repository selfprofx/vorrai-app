import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface CalendarStatus {
  provider: 'google' | 'microsoft' | 'none';
  connected: boolean;
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
  provider: 'google' | 'microsoft';
  html_link: string;
}

export interface CalendarEventsResponse {
  events: CalendarEvent[];
  provider: string;
  error?: string;
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

  getEvents(timeMin?: string, timeMax?: string): Promise<CalendarEventsResponse> {
    const params: Record<string, string> = {};
    if (timeMin) params['time_min'] = timeMin;
    if (timeMax) params['time_max'] = timeMax;
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
}
