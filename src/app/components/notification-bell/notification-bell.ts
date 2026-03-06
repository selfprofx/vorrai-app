import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NbIconModule } from '@nebular/theme';
import { NotificationService } from '../../libs/service/notification.service';

@Component({
  selector: 'app-notification-bell',
  standalone: true,
  imports: [CommonModule, NbIconModule],
  templateUrl: './notification-bell.html',
  styleUrl: './notification-bell.scss',
})
export class NotificationBellComponent {
  notificationService = inject(NotificationService);
  open = signal(false);

  toggle(): void {
    const wasOpen = this.open();
    this.open.set(!wasOpen);
    if (!wasOpen && this.notificationService.unreadCount() > 0) {
      this.notificationService.markAllRead();
    }
  }

  close(): void {
    this.open.set(false);
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
