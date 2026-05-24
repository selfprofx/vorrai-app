import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { NbCardModule, NbIconModule, NbButtonModule } from '@nebular/theme';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { NotificationService, AppNotification } from '../../libs/service/notification.service';
import { LocaleService } from '../../core/locale.service';

type FilterCategory = 'all' | 'leads' | 'chats' | 'content' | 'followups' | 'bookings';

const CATEGORY_TYPES: Record<FilterCategory, string[]> = {
  all: [],
  leads: ['new_user'],
  chats: ['chat_update'],
  content: ['content_job_done', 'template_generated'],
  followups: ['followup_sent', 'sequence_pending', 'sequence_approved', 'episode_sent'],
  bookings: ['booking_created', 'booking_updated', 'calendar_sync'],
};

@Component({
  selector: 'app-notifications',
  templateUrl: './notifications.html',
  styleUrl: './notifications.scss',
  imports: [CommonModule, TranslatePipe, NbCardModule, NbIconModule, NbButtonModule],
})
export class Notifications implements OnInit {
  private router    = inject(Router);
  private translate = inject(TranslateService);
  private locale    = inject(LocaleService);
  notificationService = inject(NotificationService);

  activeFilter = signal<FilterCategory>('all');
  filters: FilterCategory[] = ['all', 'leads', 'chats', 'content', 'followups', 'bookings'];

  readonly filteredNotifications = computed(() => {
    const all = this.notificationService.notifications();
    const filter = this.activeFilter();
    if (filter === 'all') return all;
    const types = CATEGORY_TYPES[filter];
    return all.filter(n => types.includes(n.type));
  });

  ngOnInit(): void {
    this.notificationService.loadNotifications();
  }

  setFilter(f: FilterCategory): void {
    this.activeFilter.set(f);
  }

  onNotificationClick(n: AppNotification): void {
    if (!n.read) {
      this.notificationService.markRead(n);
    }
    if (n.link) {
      this.router.navigateByUrl(n.link);
    }
  }

  onMarkAllRead(): void {
    this.notificationService.markAllRead();
  }

  iconForType(type: string): string {
    switch (type) {
      case 'new_user': return 'person-add-outline';
      case 'chat_update': return 'message-circle-outline';
      case 'content_job_done': return 'layers-outline';
      case 'template_generated': return 'email-outline';
      case 'followup_sent': return 'email-outline';
      case 'booking_created':
      case 'booking_updated': return 'calendar-outline';
      case 'sequence_pending': return 'alert-circle-outline';
      case 'sequence_approved': return 'checkmark-circle-outline';
      case 'episode_sent': return 'paper-plane-outline';
      default: return 'bell-outline';
    }
  }

  formatTime(iso: string): string {
    try {
      const d = new Date(iso);
      const now = new Date();
      const diffMs = now.getTime() - d.getTime();
      const mins = Math.floor(diffMs / 60000);
      if (mins < 1) return this.translate.instant('dashboard.time.justNow');
      if (mins < 60) return this.translate.instant('dashboard.time.minutesAgo', { mins });
      const hours = Math.floor(mins / 60);
      if (hours < 24) return this.translate.instant('dashboard.time.hoursAgo', { hours });
      return this.locale.formatDate(d);
    } catch {
      return iso;
    }
  }
}
