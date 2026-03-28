import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NbCardModule, NbSpinnerModule } from '@nebular/theme';
import { TableModule } from 'primeng/table';
import { Tag } from 'primeng/tag';
import { InputTextModule } from 'primeng/inputtext';
import { IconField } from 'primeng/iconfield';
import { InputIcon } from 'primeng/inputicon';

import { BlogService } from '../../libs/service/blog.service';

@Component({
  selector: 'blog-subscribers',
  imports: [
    CommonModule,
    NbCardModule, NbSpinnerModule,
    TableModule, Tag, InputTextModule, IconField, InputIcon,
  ],
  templateUrl: './blog-subscribers.html',
  styleUrl: './blog-subscribers.scss',
})
export class BlogSubscribers implements OnInit {
  private blogService = inject(BlogService);

  subscribers = this.blogService.subscribers;
  loading = this.blogService.loading;
  error = this.blogService.error;

  async ngOnInit() {
    this.blogService.loadSubscribers();
  }

  get activeCount(): number {
    return this.subscribers().filter(s => s.status === 'active').length;
  }

  formatDate(iso?: string | null): string {
    if (!iso) return '—';
    try { return new Date(iso).toLocaleString(); } catch { return iso; }
  }

  getStatusSeverity(status?: string | null): 'success' | 'danger' | 'info' | 'secondary' | 'warn' | 'contrast' {
    return status === 'active' ? 'success' : 'secondary';
  }
}
