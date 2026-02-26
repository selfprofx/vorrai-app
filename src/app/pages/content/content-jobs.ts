import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { InputTextModule } from 'primeng/inputtext';
import { IconField } from 'primeng/iconfield';
import { InputIcon } from 'primeng/inputicon';
import { NbCardModule } from '@nebular/theme';
import { ContentService } from '../../libs/service/content.service';
import type { ContentJob } from '../../libs/model/content-job';

@Component({
  selector: 'app-content-jobs',
  templateUrl: './content-jobs.html',
  styleUrl: './content-jobs.scss',
  imports: [CommonModule, TableModule, TagModule, InputTextModule, NbCardModule, IconField, InputIcon],
})
export class ContentJobs implements OnInit {
  private contentService = inject(ContentService);

  jobs = this.contentService.jobs;
  loading = this.contentService.loading;
  error = this.contentService.error;

  globalFilterFields = ['job_id', 'article_title', 'content_type', 'status'];

  ngOnInit(): void {
    this.contentService.load();
  }

  getSeverity(status?: string | null): 'success' | 'secondary' | 'info' | 'warn' | 'danger' | 'contrast' | null | undefined {
    switch ((status ?? '').toLowerCase()) {
      case 'completed': return 'success';
      case 'failed': return 'danger';
      case 'running': return 'warn';
      default: return 'info';
    }
  }

  formatDate(iso?: string | null): string {
    if (!iso) return '—';
    return new Date(iso).toLocaleString();
  }
}
