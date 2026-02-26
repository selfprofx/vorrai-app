import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { InputTextModule } from 'primeng/inputtext';
import { IconField } from 'primeng/iconfield';
import { InputIcon } from 'primeng/inputicon';
import { NbCardModule } from '@nebular/theme';
import { FollowupService } from '../../libs/service/followup.service';
import type { FollowupEmail } from '../../libs/model/followup';

@Component({
  selector: 'app-followups',
  templateUrl: './followups.html',
  styleUrl: './followups.scss',
  imports: [CommonModule, TableModule, TagModule, InputTextModule, NbCardModule, IconField, InputIcon],
})
export class Followups implements OnInit {
  private followupService = inject(FollowupService);

  followups = this.followupService.followups;
  loading = this.followupService.loading;
  error = this.followupService.error;

  globalFilterFields = ['email', 'article_title', 'email_subject', 'status', 'user_id'];

  ngOnInit(): void {
    this.followupService.load();
  }

  getSeverity(status?: string | null): string {
    switch ((status ?? '').toLowerCase()) {
      case 'sent': return 'success';
      case 'failed': return 'danger';
      default: return 'info';
    }
  }

  formatDate(iso?: string | null): string {
    if (!iso) return '—';
    return new Date(iso).toLocaleString();
  }
}
