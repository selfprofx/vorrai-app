import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { NbCardModule, NbSpinnerModule, NbIconModule, NbButtonModule } from '@nebular/theme';
import { TableModule } from 'primeng/table';
import { Tag } from 'primeng/tag';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { TextareaModule } from 'primeng/textarea';
import { IconField } from 'primeng/iconfield';
import { InputIcon } from 'primeng/inputicon';

import { TranslatePipe } from '@ngx-translate/core';
import { BlogService } from '../../libs/service/blog.service';
import { LocaleService } from '../../core/locale.service';
import type { BlogPost, BlogPostCreateRequest, BlogStats, PersonalizedNewsletter } from '../../libs/model/blog-post';

type ViewMode = 'list' | 'detail' | 'create' | 'success';

@Component({
  selector: 'blog',
  imports: [
    CommonModule, FormsModule, RouterModule, TranslatePipe,
    NbCardModule, NbSpinnerModule, NbIconModule, NbButtonModule,
    TableModule, Tag, ButtonModule, InputTextModule, SelectModule, TextareaModule,
    IconField, InputIcon,
  ],
  templateUrl: './blog.html',
  styleUrl: './blog.scss',
})
export class Blog implements OnInit {
  private blogService = inject(BlogService);
  private localeSvc   = inject(LocaleService);

  posts = this.blogService.posts;
  stats = this.blogService.stats;
  loading = this.blogService.loading;
  error = this.blogService.error;

  view = signal<ViewMode>('list');
  selectedPost = signal<BlogPost | null>(null);
  detailLoading = signal(false);
  creating = signal(false);
  editing = signal(false);
  publishing = signal(false);
  sendingNewsletter = signal(false);
  improvingPost = signal(false);
  lastCreatedPostId = signal<string | null>(null);

  // Create form
  createMode = signal<'ai' | 'manual'>('ai');
  form: BlogPostCreateRequest = this._defaultForm();

  // PDF upload
  uploadingPdf = signal(false);
  pdfFileName = signal<string | null>(null);
  pdfS3Key = signal<string | null>(null);

  // Format selection checkboxes
  formatLinkedin = false;
  formatYoutube = false;
  formatInstagram = false;
  formatPersonalized = false;

  dateDisplayOptions = [
    { label: 'Date & Time', value: 'datetime' },
    { label: 'Date Only', value: 'date' },
    { label: 'No Date', value: 'none' },
  ];

  // Personalized newsletters
  personalizedNewsletters = signal<PersonalizedNewsletter[]>([]);
  personalizedCount = signal<number>(0);
  personalizedLoading = signal(false);
  sendingPersonalized = signal(false);
  showPersonalized = signal(false);
  personalizedPreview = signal<PersonalizedNewsletter | null>(null);

  // Edit form
  editTitle = '';
  editContent = '';
  editDescription = '';
  editAuthor = '';
  editTags = '';

  async ngOnInit() {
    this.blogService.loadPosts();
    this.blogService.loadStats();
  }

  showList() {
    this.view.set('list');
    this.selectedPost.set(null);
    this.editing.set(false);
  }

  showCreate() {
    this.form = this._defaultForm();
    this.view.set('create');
  }

  async showDetail(post: BlogPost) {
    this.view.set('detail');
    this.detailLoading.set(true);
    this.editing.set(false);
    this.showPersonalized.set(false);
    this.personalizedPreview.set(null);
    const full = await this.blogService.getPost(post.post_id);
    this.selectedPost.set(full ?? post);
    this._loadEditFields(full ?? post);
    this.detailLoading.set(false);
    // Load personalized newsletter count in background
    this._loadPersonalizedCount(post.post_id);
  }

  toggleEdit() {
    this.editing.set(!this.editing());
  }

  async saveEdit() {
    const post = this.selectedPost();
    if (!post) return;
    this.detailLoading.set(true);
    const tags = this.editTags.split(',').map(t => t.trim()).filter(Boolean);
    const updated = await this.blogService.updatePost(post.post_id, {
      title: this.editTitle,
      content: this.editContent,
      description: this.editDescription,
      author: this.editAuthor,
      tags,
    });
    if (updated) {
      this.selectedPost.set(updated);
      this._loadEditFields(updated);
      this.editing.set(false);
      this.blogService.loadPosts();
    }
    this.detailLoading.set(false);
  }

  async publishPost() {
    const post = this.selectedPost();
    if (!post) return;
    this.publishing.set(true);
    const updated = await this.blogService.publishPost(post.post_id);
    if (updated) {
      this.selectedPost.set(updated);
      this._loadEditFields(updated);
      this.blogService.loadPosts();
      this.blogService.loadStats();
    }
    this.publishing.set(false);
  }

  async sendNewsletter() {
    const post = this.selectedPost();
    if (!post) return;
    this.sendingNewsletter.set(true);
    const result = await this.blogService.sendNewsletter(post.post_id);
    if (result) {
      const updated = await this.blogService.getPost(post.post_id);
      if (updated) this.selectedPost.set(updated);
      this.blogService.loadPosts();
      this.blogService.loadStats();
    }
    this.sendingNewsletter.set(false);
  }

  async improvePost() {
    const post = this.selectedPost();
    if (!post) return;
    this.improvingPost.set(true);
    const result = await this.blogService.improvePost(post.post_id);
    if (result) {
      const updated = await this.blogService.getPost(post.post_id);
      if (updated) this.selectedPost.set(updated);
      this.blogService.loadPosts();
    }
    this.improvingPost.set(false);
  }

  async onPdfSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    this.uploadingPdf.set(true);
    this.pdfFileName.set(file.name);

    try {
      // Get presigned upload URL
      const res = await this.blogService.uploadPdf(file.name);
      if (!res) throw new Error('Failed to get upload URL');

      // Upload PDF directly to S3
      await fetch(res.upload_url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/pdf' },
        body: file,
      });

      this.pdfS3Key.set(res.s3_key);
      this.form.source_pdf_url = res.s3_key;
    } catch (err: any) {
      this.blogService.error.set('Failed to upload PDF: ' + (err?.message ?? 'Unknown error'));
      this.pdfFileName.set(null);
      this.pdfS3Key.set(null);
    } finally {
      this.uploadingPdf.set(false);
    }
  }

  private _buildRequestedFormats(): string[] {
    const formats = ['blog'];
    if (this.formatLinkedin) formats.push('linkedin');
    if (this.formatYoutube) formats.push('youtube');
    if (this.formatInstagram) formats.push('instagram');
    if (this.formatPersonalized) formats.push('personalized_newsletter');
    return formats;
  }

  async submitCreate() {
    this.creating.set(true);
    this.form.requested_formats = this._buildRequestedFormats();
    const result = await this.blogService.createPost(this.form);
    this.creating.set(false);
    if (result) {
      this.lastCreatedPostId.set(result.post_id);
      await this.blogService.loadPosts();
      this.blogService.loadStats();
      this.view.set('success');
    }
  }

  resetAndCreate() {
    this.form = this._defaultForm();
    this.pdfFileName.set(null);
    this.pdfS3Key.set(null);
    this.formatLinkedin = false;
    this.formatYoutube = false;
    this.formatInstagram = false;
    this.formatPersonalized = false;
    this.view.set('create');
  }

  getStatusSeverity(status?: string | null): 'success' | 'danger' | 'info' | 'secondary' | 'warn' | 'contrast' {
    switch ((status ?? '').toLowerCase()) {
      case 'published': return 'success';
      case 'draft':     return 'secondary';
      case 'generating':
      case 'improving':
      case 'pending_review': return 'warn';
      case 'archived':  return 'info';
      default:          return 'info';
    }
  }

  getEmailSeverity(status?: string | null): 'success' | 'danger' | 'info' | 'secondary' | 'warn' | 'contrast' {
    switch ((status ?? '').toLowerCase()) {
      case 'sent':    return 'success';
      case 'sending': return 'warn';
      default:        return 'secondary';
    }
  }

  formatDate(iso?: string | null): string {
    if (!iso) return '—';
    try { return this.localeSvc.formatDate(iso, { dateStyle: 'short', timeStyle: 'short' }); } catch { return iso; }
  }

  canPublish(post: BlogPost): boolean {
    return post.status === 'draft' || post.status === 'pending_review';
  }

  canSendNewsletter(post: BlogPost): boolean {
    return post.status === 'published' && post.email_status === 'not_sent';
  }

  // ------------------------------------------------------------------
  // Personalized newsletters
  // ------------------------------------------------------------------

  async togglePersonalized() {
    const post = this.selectedPost();
    if (!post) return;
    const show = !this.showPersonalized();
    this.showPersonalized.set(show);
    if (show && this.personalizedNewsletters().length === 0) {
      await this.loadPersonalizedNewsletters(post.post_id);
    }
  }

  async loadPersonalizedNewsletters(postId: string) {
    this.personalizedLoading.set(true);
    const items = await this.blogService.getPersonalizedNewsletters(postId);
    this.personalizedNewsletters.set(items);
    this.personalizedLoading.set(false);
  }

  async previewPersonalized(pn: PersonalizedNewsletter) {
    const post = this.selectedPost();
    if (!post) return;
    const full = await this.blogService.getPersonalizedNewsletter(post.post_id, pn.user_id);
    this.personalizedPreview.set(full);
  }

  closePreview() {
    this.personalizedPreview.set(null);
  }

  async sendAllPersonalized() {
    const post = this.selectedPost();
    if (!post) return;
    this.sendingPersonalized.set(true);
    await this.blogService.sendPersonalizedNewsletters(post.post_id);
    await this.loadPersonalizedNewsletters(post.post_id);
    this.sendingPersonalized.set(false);
  }

  async sendSelectedPersonalized(userIds: string[]) {
    const post = this.selectedPost();
    if (!post || !userIds.length) return;
    this.sendingPersonalized.set(true);
    await this.blogService.sendPersonalizedNewsletters(post.post_id, userIds);
    await this.loadPersonalizedNewsletters(post.post_id);
    this.sendingPersonalized.set(false);
  }

  getPersonalizedStatusSeverity(status: string): 'success' | 'danger' | 'info' | 'secondary' | 'warn' | 'contrast' {
    switch (status) {
      case 'sent':      return 'success';
      case 'approved':  return 'info';
      case 'generated': return 'warn';
      case 'skipped':   return 'secondary';
      default:          return 'info';
    }
  }

  private async _loadPersonalizedCount(postId: string) {
    const count = await this.blogService.getPersonalizedCount(postId);
    this.personalizedCount.set(count);
  }

  private _defaultForm(): BlogPostCreateRequest {
    return {
      briefing: '',
      date_display_mode: 'datetime',
    };
  }

  private _loadEditFields(post: BlogPost) {
    this.editTitle = post.title ?? '';
    this.editContent = post.content ?? '';
    this.editDescription = post.description ?? '';
    this.editAuthor = post.author ?? '';
    this.editTags = (post.tags ?? []).join(', ');
  }
}
