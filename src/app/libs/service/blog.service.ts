import { Injectable, inject, signal, WritableSignal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import type { BlogPost, BlogPostCreateRequest, BlogStats, NewsletterSubscriber, PersonalizedNewsletter, PersonalizedNewsletterCount } from '../model/blog-post';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class BlogService {
  private http = inject(HttpClient);
  private base = environment.apiUrl;

  posts: WritableSignal<BlogPost[]> = signal<BlogPost[]>([]);
  subscribers: WritableSignal<NewsletterSubscriber[]> = signal<NewsletterSubscriber[]>([]);
  stats: WritableSignal<BlogStats | null> = signal<BlogStats | null>(null);
  loading = signal(false);
  error = signal<string | null>(null);

  async loadPosts(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const res = await firstValueFrom(
        this.http.get<{ items: BlogPost[] }>(`${this.base}/dashboard/blog/posts`)
      );
      this.posts.set(res?.items ?? []);
    } catch (err: any) {
      this.error.set(err?.error?.message ?? err?.message ?? 'Failed to load blog posts');
    } finally {
      this.loading.set(false);
    }
  }

  async getPost(postId: string): Promise<BlogPost | null> {
    try {
      return await firstValueFrom(
        this.http.get<BlogPost>(`${this.base}/dashboard/blog/posts/${postId}`)
      );
    } catch {
      return null;
    }
  }

  async createPost(request: BlogPostCreateRequest): Promise<{ post_id: string; status: string } | null> {
    try {
      return await firstValueFrom(
        this.http.post<{ post_id: string; status: string }>(
          `${this.base}/dashboard/blog/posts/create`,
          request,
        )
      );
    } catch (err: any) {
      this.error.set(err?.error?.message ?? err?.message ?? 'Failed to create blog post');
      return null;
    }
  }

  async updatePost(postId: string, data: Partial<BlogPost>): Promise<BlogPost | null> {
    try {
      return await firstValueFrom(
        this.http.put<BlogPost>(`${this.base}/dashboard/blog/posts/${postId}`, data)
      );
    } catch (err: any) {
      this.error.set(err?.error?.message ?? err?.message ?? 'Failed to update blog post');
      return null;
    }
  }

  async publishPost(postId: string): Promise<BlogPost | null> {
    try {
      return await firstValueFrom(
        this.http.post<BlogPost>(`${this.base}/dashboard/blog/posts/${postId}/publish`, {})
      );
    } catch (err: any) {
      this.error.set(err?.error?.message ?? err?.message ?? 'Failed to publish blog post');
      return null;
    }
  }

  async sendNewsletter(postId: string): Promise<{ post_id: string; email_status: string } | null> {
    try {
      return await firstValueFrom(
        this.http.post<{ post_id: string; email_status: string }>(
          `${this.base}/dashboard/blog/posts/${postId}/send-newsletter`,
          {},
        )
      );
    } catch (err: any) {
      this.error.set(err?.error?.message ?? err?.message ?? 'Failed to send newsletter');
      return null;
    }
  }

  async loadSubscribers(): Promise<void> {
    this.loading.set(true);
    try {
      const res = await firstValueFrom(
        this.http.get<{ items: NewsletterSubscriber[]; active_count: number }>(
          `${this.base}/dashboard/blog/subscribers`
        )
      );
      this.subscribers.set(res?.items ?? []);
    } catch (err: any) {
      this.error.set(err?.error?.message ?? err?.message ?? 'Failed to load subscribers');
    } finally {
      this.loading.set(false);
    }
  }

  async loadStats(): Promise<void> {
    try {
      const res = await firstValueFrom(
        this.http.get<BlogStats>(`${this.base}/dashboard/blog/stats`)
      );
      this.stats.set(res);
    } catch {
      // stats are non-critical
    }
  }

  // ------------------------------------------------------------------
  // PDF upload
  // ------------------------------------------------------------------

  async uploadPdf(filename: string): Promise<{ upload_url: string; s3_key: string } | null> {
    try {
      return await firstValueFrom(
        this.http.post<{ upload_url: string; s3_key: string }>(
          `${this.base}/dashboard/blog/upload-pdf`,
          { filename },
        )
      );
    } catch (err: any) {
      this.error.set(err?.error?.message ?? err?.message ?? 'Failed to get upload URL');
      return null;
    }
  }

  // ------------------------------------------------------------------
  // Personalized newsletters
  // ------------------------------------------------------------------

  async getPersonalizedNewsletters(postId: string): Promise<PersonalizedNewsletter[]> {
    try {
      const res = await firstValueFrom(
        this.http.get<PersonalizedNewsletter[]>(
          `${this.base}/dashboard/blog/posts/${postId}/personalized`
        )
      );
      return res ?? [];
    } catch {
      return [];
    }
  }

  async getPersonalizedNewsletter(postId: string, userId: string): Promise<PersonalizedNewsletter | null> {
    try {
      return await firstValueFrom(
        this.http.get<PersonalizedNewsletter>(
          `${this.base}/dashboard/blog/posts/${postId}/personalized/${encodeURIComponent(userId)}`
        )
      );
    } catch {
      return null;
    }
  }

  async getPersonalizedCount(postId: string): Promise<number> {
    try {
      const res = await firstValueFrom(
        this.http.get<PersonalizedNewsletterCount>(
          `${this.base}/dashboard/blog/posts/${postId}/personalized/count`
        )
      );
      return res?.count ?? 0;
    } catch {
      return 0;
    }
  }

  async sendPersonalizedNewsletters(postId: string, userIds?: string[]): Promise<{ status: string } | null> {
    try {
      return await firstValueFrom(
        this.http.post<{ status: string }>(
          `${this.base}/dashboard/blog/posts/${postId}/personalized/send`,
          userIds ? { user_ids: userIds } : {},
        )
      );
    } catch (err: any) {
      this.error.set(err?.error?.message ?? err?.message ?? 'Failed to send personalized newsletters');
      return null;
    }
  }
}
