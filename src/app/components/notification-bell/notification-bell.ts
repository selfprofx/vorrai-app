import { Component, ElementRef, HostListener, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { NbIconModule } from '@nebular/theme';
import { NotificationService, AppNotification } from '../../libs/service/notification.service';

@Component({
  selector: 'app-notification-bell',
  standalone: true,
  imports: [CommonModule, NbIconModule],
  templateUrl: './notification-bell.html',
  styleUrl: './notification-bell.scss',
})
export class NotificationBellComponent {
  notificationService = inject(NotificationService);
  private router = inject(Router);
  private host = inject(ElementRef<HTMLElement>);
  open = signal(false);

  // The template binds (clickOutside)="close()" but no such directive exists
  // in the project — Angular silently accepts unknown event bindings on
  // standard elements, so the dropdown never closes on outside click. Listen
  // on document instead and close when the click lands outside this host.
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.open()) return;
    if (!this.host.nativeElement.contains(event.target as Node)) {
      this.close();
    }
  }

  /** Top 7 notifications for the dropdown */
  get topNotifications(): AppNotification[] {
    return this.notificationService.notifications().slice(0, 7);
  }

  toggle(): void {
    this.open.set(!this.open());
  }

  close(): void {
    this.open.set(false);
  }

  onNotificationClick(n: AppNotification): void {
    if (!n.read) {
      this.notificationService.markRead(n);
    }
    this.close();
    if (n.link) {
      this.router.navigateByUrl(n.link);
    }
  }

  onMarkAllRead(): void {
    this.notificationService.markAllRead();
  }

  onSettingsClick(): void {
    this.close();
    this.router.navigate(['/settings'], { queryParams: { tab: 'settings' } });
  }

  onShowAllClick(): void {
    this.close();
    this.router.navigate(['/notifications']);
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
      if (mins < 1) return 'just now';
      if (mins < 60) return `${mins}m ago`;
      const hours = Math.floor(mins / 60);
      if (hours < 24) return `${hours}h ago`;
      return d.toLocaleDateString();
    } catch {
      return iso;
    }
  }
}
