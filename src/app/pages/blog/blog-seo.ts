import { Component, OnInit, OnDestroy, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { NbCardModule, NbSpinnerModule, NbIconModule, NbButtonModule } from '@nebular/theme';
import { TableModule } from 'primeng/table';
import { Tag } from 'primeng/tag';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { Subscription } from 'rxjs';

import { TranslatePipe } from '@ngx-translate/core';
import { TooltipModule } from 'primeng/tooltip';
import { BlogService } from '../../libs/service/blog.service';
import { AppWsService } from '../../libs/service/app-ws.service';
import { LocaleService } from '../../core/locale.service';
import type { PostPerformanceSummary, KeywordData, BlogPostPerformance } from '../../libs/model/blog-post';

type ViewMode = 'list' | 'detail';

@Component({
  selector: 'blog-seo',
  imports: [
    CommonModule, RouterModule, TranslatePipe,
    NbCardModule, NbSpinnerModule, NbIconModule, NbButtonModule,
    TableModule, Tag, ButtonModule, DialogModule, TooltipModule,
  ],
  templateUrl: './blog-seo.html',
  styleUrl: './blog-seo.scss',
})
export class BlogSeo implements OnInit, OnDestroy {
  private blogService = inject(BlogService);
  private appWs = inject(AppWsService);
  private locale = inject(LocaleService);
  private wsSub?: Subscription;

  performance = this.blogService.performance;
  loading = this.blogService.performanceLoading;
  error = this.blogService.error;

  view = signal<ViewMode>('list');
  selectedPost = signal<PostPerformanceSummary | null>(null);
  postHistory = signal<BlogPostPerformance[]>([]);
  detailLoading = signal(false);
  improving = signal(false);
  polling = signal(false);
  confirmImprove = signal(false);

  // Aggregate stats
  totalImpressions = computed(() => this.performance().reduce((s, p) => s + (p.impressions ?? 0), 0));
  totalClicks = computed(() => this.performance().reduce((s, p) => s + (p.clicks ?? 0), 0));
  avgPosition = computed(() => {
    const items = this.performance().filter(p => p.position != null && p.position > 0);
    if (!items.length) return 0;
    return Math.round(items.reduce((s, p) => s + (p.position ?? 0), 0) / items.length * 10) / 10;
  });
  avgCtr = computed(() => {
    const items = this.performance().filter(p => p.ctr != null);
    if (!items.length) return 0;
    return Math.round(items.reduce((s, p) => s + (p.ctr ?? 0), 0) / items.length * 10000) / 100;
  });

  ngOnInit() {
    this.blogService.loadPerformance();
    this.appWs.connect();
    this.wsSub = this.appWs.on('gsc_poll_complete', 'blog_post_improved').subscribe((msg: any) => {
      if (msg.type === 'gsc_poll_complete') {
        this.polling.set(false);
        this.blogService.loadPerformance();
      }
      if (msg.type === 'blog_post_improved') {
        this.improving.set(false);
        this.blogService.loadPerformance();
      }
    });
  }

  ngOnDestroy() {
    this.wsSub?.unsubscribe();
  }

  async showDetail(item: PostPerformanceSummary) {
    this.view.set('detail');
    this.selectedPost.set(item);
    this.detailLoading.set(true);
    const history = await this.blogService.getPostPerformance(item.post_id);
    this.postHistory.set(history);
    this.detailLoading.set(false);
  }

  showList() {
    this.view.set('list');
    this.selectedPost.set(null);
    this.postHistory.set([]);
  }

  async refreshGsc() {
    this.polling.set(true);
    await this.blogService.triggerGscPoll();
  }

  async improveWriting() {
    const post = this.selectedPost();
    if (!post) return;
    this.confirmImprove.set(false);
    this.improving.set(true);
    await this.blogService.improvePost(post.post_id);
  }

  getPositionSeverity(position?: number | null): 'success' | 'info' | 'warn' | 'danger' | 'secondary' {
    if (position == null || position <= 0) return 'secondary';
    if (position <= 3) return 'success';
    if (position <= 10) return 'info';
    if (position <= 20) return 'warn';
    return 'danger';
  }

  formatCtr(ctr?: number | null): string {
    if (ctr == null) return '—';
    return (ctr * 100).toFixed(1) + '%';
  }

  formatPosition(pos?: number | null): string {
    if (pos == null || pos <= 0) return '—';
    return pos.toFixed(1);
  }

  formatDate(iso?: string | null): string {
    if (!iso) return '—';
    try { return this.locale.formatDate(iso, { dateStyle: 'short' }); }
    catch { return iso; }
  }

  getPageRecords(): BlogPostPerformance[] {
    return this.postHistory().filter(r => r.data_type === 'page');
  }

  getKeywordRecords(): BlogPostPerformance[] {
    return this.postHistory().filter(r => r.data_type === 'keyword');
  }
}
