import { Component, OnInit, OnDestroy, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  NbCardModule, NbButtonModule, NbInputModule, NbIconModule,
  NbBadgeModule, NbSpinnerModule, NbToastrService, NbAccordionModule,
  NbTagModule,
} from '@nebular/theme';
import { Subscription } from 'rxjs';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { CodeEditorComponent } from '../../components/code-editor/code-editor';
import { EmailTemplateService } from '../../libs/service/email-template.service';
import { AppWsService } from '../../libs/service/app-ws.service';
import type { EmailTemplateSummary, EmailTemplateDetail } from '../../libs/model/email-template';

const TEMPLATE_LABELS: Record<string, string> = {
  chat_link: 'Chat Invitation',
  verification: 'Email Verification',
  day0: 'Day 0 Kickoff',
  episode: 'Episode Series',
  booking: 'Booking Confirmation',
};

@Component({
  selector: 'app-email-templates',
  templateUrl: './email-templates.html',
  styleUrl: './email-templates.scss',
  imports: [
    CommonModule, FormsModule,
    NbCardModule, NbButtonModule, NbInputModule, NbIconModule,
    NbBadgeModule, NbSpinnerModule, NbAccordionModule, NbTagModule,
    CodeEditorComponent, TranslatePipe,
  ],
})
export class EmailTemplates implements OnInit, OnDestroy {
  private svc = inject(EmailTemplateService);
  private appWs = inject(AppWsService);
  private toastr = inject(NbToastrService);
  private translate = inject(TranslateService);
  private wsSub: Subscription | null = null;

  readonly templates = this.svc.templates;
  readonly loading = this.svc.loading;
  readonly saving = this.svc.saving;
  readonly generating = this.svc.generating;
  readonly error = this.svc.error;

  selectedType = signal<string | null>(null);
  readonly current = this.svc.currentTemplate;

  // Editable fields
  editSubject = signal('');
  editHtml = signal('');
  editText = signal('');
  showHtmlEditor = signal(false);
  showTextEditor = signal(false);

  readonly designTokensJson = computed(() => {
    const tokens = this.current()?.design_tokens;
    return tokens ? JSON.stringify(tokens, null, 2) : '';
  });

  getLabel(type: string): string {
    return TEMPLATE_LABELS[type] || type;
  }

  getStatusText(tpl: EmailTemplateSummary): string {
    return this.translate.instant(tpl.has_html ? 'emailTemplates.statusActive' : 'emailTemplates.statusNotConfigured');
  }

  getStatusClass(tpl: EmailTemplateSummary): string {
    return tpl.has_html ? 'success' : 'basic';
  }

  getCreatedByLabel(tpl: EmailTemplateSummary): string {
    const key = tpl.created_by && ['seed', 'manual', 'ai_crew'].includes(tpl.created_by)
      ? `emailTemplates.createdBy.${tpl.created_by}`
      : 'emailTemplates.createdBy.unknown';
    return this.translate.instant(key);
  }

  async ngOnInit() {
    await this.svc.loadAll();

    this.wsSub = this.appWs.on('template_generated').subscribe(async (msg) => {
      this.svc.generating.set(false);
      this.toastr.success(
        this.translate.instant('emailTemplates.toast.generated', { name: this.getLabel(msg['template_type']) }),
        this.translate.instant('emailTemplates.toast.ready'),
      );
      await this.svc.loadAll();
      if (this.selectedType() === msg['template_type']) {
        await this.svc.loadOne(msg['template_type']);
        this._syncEditFields();
      }
    });
  }

  ngOnDestroy() {
    this.wsSub?.unsubscribe();
  }

  async selectTemplate(type: string) {
    if (this.selectedType() === type) {
      this.selectedType.set(null);
      this.svc.currentTemplate.set(null);
      return;
    }
    this.selectedType.set(type);
    await this.svc.loadOne(type);
    this._syncEditFields();
  }

  async save() {
    const type = this.selectedType();
    if (!type) return;
    await this.svc.save(type, {
      subject_template: this.editSubject(),
      html_template: this.editHtml(),
      text_template: this.editText(),
    });
    this._syncEditFields();
    this.toastr.success(
      this.translate.instant('emailTemplates.toast.saved'),
      this.translate.instant('emailTemplates.toast.savedTitle'),
    );
  }

  async regenerate() {
    const type = this.selectedType();
    if (!type) return;
    await this.svc.generate(type);
    this.toastr.info(
      this.translate.instant('emailTemplates.toast.generating'),
      this.translate.instant('emailTemplates.toast.generatingTitle'),
    );
  }

  private _syncEditFields() {
    const tpl = this.current();
    this.editSubject.set(tpl?.subject_template || '');
    this.editHtml.set(tpl?.html_template || '');
    this.editText.set(tpl?.text_template || '');
  }
}
