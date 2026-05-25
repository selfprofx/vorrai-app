import {
  Component, OnInit, signal, computed, inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  NbCardModule, NbButtonModule, NbInputModule, NbIconModule,
  NbAlertModule, NbToastrService, NbSpinnerModule,
} from '@nebular/theme';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ProductService } from '../../libs/service/product.service';
import { AuthService } from '../../libs/service/auth.service';
import { LabelService } from '../../core/label.service';
import { ConfirmDialogService } from '../../core/confirm-dialog.service';
import type { Persona, Product } from '../../libs/model/product';

function emptyPersona(): Partial<Persona> {
  return { name: '', description: '', pain_points: '', demographics: '',
           desires: '', utm_persona: '', product_id: '' };
}

@Component({
  selector: 'app-personas',
  templateUrl: './council.html',
  styleUrl: './council.scss',
  imports: [
    CommonModule, FormsModule, TranslatePipe,
    NbCardModule, NbButtonModule, NbInputModule, NbIconModule,
    NbAlertModule, NbSpinnerModule,
  ],
})
export class Council implements OnInit {
  private svc       = inject(ProductService);
  private auth      = inject(AuthService);
  private toastr    = inject(NbToastrService);
  private translate = inject(TranslateService);
  private confirm   = inject(ConfirmDialogService);

  /** Reactive label dictionary — flips with the tenant's vertical so the
   *  page title honours "Personas" / "Patient Personas". */
  protected labels = inject(LabelService).labels;

  // ── Service state ─────────────────────────────────────────────────────────
  readonly personas = computed(() => this.svc.personas());
  readonly products = computed(() => this.svc.products());
  readonly loading  = computed(() => this.svc.loading());
  readonly aiLoading = computed(() => this.svc.aiLoading());
  readonly error    = computed(() => this.svc.error());

  // ── UI state ──────────────────────────────────────────────────────────────
  selectedPersona = signal<Persona | null>(null);
  editMode        = signal(false);
  saving          = signal(false);
  deleting        = signal<string | null>(null);

  // ── Form ──────────────────────────────────────────────────────────────────
  personaForm = signal<Partial<Persona>>(emptyPersona());

  // ── AI ────────────────────────────────────────────────────────────────────
  aiSuggestion  = signal<Record<string, any> | null>(null);
  aiFlagged     = signal(false);
  aiFlagReason  = signal('');

  private get tenantCtx() {
    return { business_name: this.auth.getTenantId() ?? '', description: '', target_persona: '' };
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  getProductName(productId?: string | null): string {
    if (!productId) return '';
    const p = this.products().find(x => x.id === productId);
    return p?.name ?? '';
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────
  async ngOnInit() {
    await Promise.all([
      this.svc.loadPersonas(),
      this.svc.loadProducts(),
    ]);
  }

  // ── Selection ─────────────────────────────────────────────────────────────
  selectPersona(p: Persona) {
    this.selectedPersona.set(p);
    this.personaForm.set({ ...p });
    this.editMode.set(false);
    this.clearAi();
  }

  // ── CRUD ──────────────────────────────────────────────────────────────────
  openNew() {
    this.selectedPersona.set(null);
    this.personaForm.set(emptyPersona());
    this.editMode.set(true);
    this.clearAi();
  }

  editPersona() {
    this.editMode.set(true);
    this.clearAi();
  }

  cancelEdit() {
    if (this.selectedPersona()) {
      this.personaForm.set({ ...this.selectedPersona()! });
    }
    this.editMode.set(false);
    this.clearAi();
  }

  setField(key: keyof Persona, val: any) {
    this.personaForm.update(f => ({ ...f, [key]: val }));
  }

  async savePersona() {
    const form = this.personaForm();
    if (!form.name?.trim()) {
      this.toastr.danger(
        this.translate.instant('personas.toast.nameRequired'),
        this.translate.instant('personas.toast.validation'),
      );
      return;
    }
    this.saving.set(true);
    const result = (form as any).id
      ? await this.svc.updatePersona((form as any).id, form)
      : await this.svc.createPersona(form);
    this.saving.set(false);
    if (result) {
      this.selectedPersona.set(result);
      this.personaForm.set({ ...result });
      this.editMode.set(false);
      this.clearAi();
      this.toastr.success(
        this.translate.instant('personas.toast.saved'),
        this.translate.instant('personas.toast.savedTitle'),
      );
    } else {
      this.toastr.danger(
        this.svc.error() ?? this.translate.instant('personas.toast.saveError'),
        this.translate.instant('personas.toast.errorTitle'),
      );
    }
  }

  async deletePersona(id: string) {
    const ok = await this.confirm.confirm({
      messageKey: 'personas.toast.confirmDelete',
      confirmKey: 'common.action.delete',
      danger: true,
    });
    if (!ok) return;
    this.deleting.set(id);
    const success = await this.svc.deletePersona(id);
    this.deleting.set(null);
    if (success) {
      if (this.selectedPersona()?.id === id) this.selectedPersona.set(null);
      this.toastr.success(
        this.translate.instant('personas.toast.deleted'),
        this.translate.instant('personas.toast.deletedTitle'),
      );
    } else {
      this.toastr.danger(
        this.translate.instant('personas.toast.deleteError'),
        this.translate.instant('personas.toast.errorTitle'),
      );
    }
  }

  // ── AI ────────────────────────────────────────────────────────────────────
  async askAi() {
    this.clearAi();
    const res = await this.svc.getAiRecommendation(
      'persona', this.personaForm() as Record<string, any>, this.tenantCtx);
    this.aiFlagged.set(res.flagged);
    this.aiFlagReason.set(res.flag_reason ?? '');
    this.aiSuggestion.set(res.suggestion);
  }

  acceptAiSuggestion() {
    const s = this.aiSuggestion();
    if (!s) return;
    this.personaForm.update(f => ({ ...f, ...s }));
    this.clearAi();
    this.toastr.success(
      this.translate.instant('personas.ai.applied'),
      this.translate.instant('personas.ai.appliedTitle'),
    );
  }

  clearAi() {
    this.aiSuggestion.set(null);
    this.aiFlagged.set(false);
    this.aiFlagReason.set('');
  }

  aiEntries(): [string, any][] {
    const s = this.aiSuggestion();
    return s ? Object.entries(s).filter(([, v]) => v != null) : [];
  }

  trackBy(_: number, item: any) { return item.id; }
}
