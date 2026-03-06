import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NbCardModule, NbSpinnerModule, NbIconModule, NbButtonModule } from '@nebular/theme';
import { TableModule } from 'primeng/table';
import { Tag } from 'primeng/tag';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { TextareaModule } from 'primeng/textarea';
import { IconField } from 'primeng/iconfield';
import { InputIcon } from 'primeng/inputicon';

import { ContentService } from '../../libs/service/content.service';
import type { ContentJob, ContentCreateRequest } from '../../libs/model/content-job';

type ViewMode = 'list' | 'detail' | 'create';

@Component({
  selector: 'contents',
  imports: [
    CommonModule, FormsModule,
    NbCardModule, NbSpinnerModule, NbIconModule, NbButtonModule,
    TableModule, Tag, ButtonModule, InputTextModule, SelectModule, TextareaModule,
    IconField, InputIcon,
  ],
  templateUrl: './contents.html',
  styleUrl: './contents.scss',
})
export class Contents implements OnInit {
  private contentService = inject(ContentService);
  objectKeys = Object.keys;

  jobs   = this.contentService.jobs;
  loading = this.contentService.loading;
  error   = this.contentService.error;

  view = signal<ViewMode>('list');
  selectedJob = signal<ContentJob | null>(null);
  detailLoading = signal(false);
  creating = signal(false);

  // Create form
  form: ContentCreateRequest = {
    job_type: 'default_hero',
    delivery_mode: 'full',
    briefing: '',
    editorial_type: 'Clazz',
    audience_state: 'Awareness',
    output_formats: ['IMAGE_POST'],
  };

  jobTypeOptions = [
    { label: 'Default Hero', value: 'default_hero' },
    { label: 'Premium Hero', value: 'premium_hero' },
  ];

  deliveryModeOptions = [
    { label: 'Full', value: 'full' },
    { label: 'Novel Sequence (7-part)', value: 'novel_sequence' },
  ];

  editorialTypeOptions = [
    { label: 'Clazz', value: 'Clazz' },
    { label: 'Interview', value: 'Interview' },
    { label: 'Lists', value: 'Lists' },
    { label: 'Infographics', value: 'Infographics' },
    { label: 'Q&A', value: 'Q_A' },
    { label: 'Curiosities', value: 'Curiosities' },
  ];

  audienceStateOptions = [
    { label: 'Awareness', value: 'Awareness' },
    { label: 'Opportunity', value: 'Opportunity' },
    { label: 'Urgency', value: 'Urgency' },
  ];

  outputFormatOptions = [
    { label: 'Image Post', value: 'IMAGE_POST' },
    { label: 'Carousel', value: 'CAROUSEL' },
    { label: 'Newsletter', value: 'NEWSLETTER' },
    { label: 'Story 9x16', value: 'STORY_9x16' },
    { label: 'Video Short', value: 'VIDEO_SHORT' },
  ];

  ngOnInit() {
    this.contentService.load();
  }

  showList() {
    this.view.set('list');
    this.selectedJob.set(null);
  }

  showCreate() {
    this.view.set('create');
  }

  async showDetail(job: ContentJob) {
    this.view.set('detail');
    this.detailLoading.set(true);
    const full = await this.contentService.getById(job.job_id);
    this.selectedJob.set(full ?? job);
    this.detailLoading.set(false);
  }

  async submitCreate() {
    this.creating.set(true);
    const result = await this.contentService.create(this.form);
    this.creating.set(false);
    if (result) {
      await this.contentService.load();
      this.showList();
    }
  }

  getSeverity(status?: string | null): 'success' | 'danger' | 'info' | 'secondary' | 'warn' | 'contrast' {
    switch ((status ?? '').toLowerCase()) {
      case 'completed': return 'success';
      case 'failed':    return 'danger';
      case 'running':   return 'warn';
      default:          return 'info';
    }
  }

  formatDate(iso?: string | null): string {
    if (!iso) return '—';
    try { return new Date(iso).toLocaleString(); } catch { return iso; }
  }

  toggleOutputFormat(value: string) {
    const current = this.form.output_formats ?? [];
    const idx = current.indexOf(value);
    if (idx >= 0) {
      current.splice(idx, 1);
    } else {
      current.push(value);
    }
    this.form.output_formats = [...current];
  }

  hasOutputFormat(value: string): boolean {
    return (this.form.output_formats ?? []).includes(value);
  }
}
