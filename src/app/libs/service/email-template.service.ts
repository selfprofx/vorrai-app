import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { EmailTemplateSummary, EmailTemplateDetail } from '../model/email-template';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class EmailTemplateService {
  private http = inject(HttpClient);
  private base = environment.apiUrl;

  templates = signal<EmailTemplateSummary[]>([]);
  currentTemplate = signal<EmailTemplateDetail | null>(null);
  loading = signal(false);
  saving = signal(false);
  generating = signal(false);
  error = signal<string | null>(null);

  async loadAll(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const res = await firstValueFrom(
        this.http.get<{ items: EmailTemplateSummary[] }>(
          `${this.base}/dashboard/email-templates`
        )
      );
      this.templates.set(res.items);
    } catch (e: any) {
      this.error.set(e?.error?.Message || 'Failed to load templates');
    } finally {
      this.loading.set(false);
    }
  }

  async loadOne(templateType: string): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const res = await firstValueFrom(
        this.http.get<EmailTemplateDetail>(
          `${this.base}/dashboard/email-templates/${templateType}`
        )
      );
      this.currentTemplate.set(res);
    } catch (e: any) {
      this.error.set(e?.error?.Message || 'Template not found');
      this.currentTemplate.set(null);
    } finally {
      this.loading.set(false);
    }
  }

  async save(templateType: string, patch: Partial<EmailTemplateDetail>): Promise<void> {
    this.saving.set(true);
    this.error.set(null);
    try {
      await firstValueFrom(
        this.http.put(
          `${this.base}/dashboard/email-templates/${templateType}`,
          patch
        )
      );
      await this.loadOne(templateType);
      await this.loadAll();
    } catch (e: any) {
      this.error.set(e?.error?.Message || 'Failed to save template');
    } finally {
      this.saving.set(false);
    }
  }

  async generate(templateType: string): Promise<void> {
    this.generating.set(true);
    this.error.set(null);
    try {
      await firstValueFrom(
        this.http.post(
          `${this.base}/dashboard/email-templates/${templateType}/generate`,
          {}
        )
      );
      // Template will arrive via WebSocket — don't reload immediately
    } catch (e: any) {
      this.error.set(e?.error?.Message || 'Failed to queue generation');
      this.generating.set(false);
    }
  }
}
