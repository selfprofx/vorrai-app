import {
  Component, OnInit, signal, computed, inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  NbCardModule, NbButtonModule, NbInputModule, NbIconModule,
  NbAlertModule, NbToastrService, NbSpinnerModule,
} from '@nebular/theme';
import { ProductService } from '../../libs/service/product.service';
import { AuthService } from '../../libs/service/auth.service';
import { LabelService } from '../../core/label.service';
import type { TenantOffer, Product } from '../../libs/model/product';

function emptyOffer(): Partial<TenantOffer> {
  return { name: '', headline: '', subheadline: '', description: '',
           guarantee: '30-day money-back guarantee.', price_usd: '',
           stack_items: [], utm_content: '', product_id: '' };
}

@Component({
  selector: 'app-offers',
  templateUrl: './offers.html',
  styleUrl: './offers.scss',
  imports: [
    CommonModule, FormsModule,
    NbCardModule, NbButtonModule, NbInputModule, NbIconModule,
    NbAlertModule, NbSpinnerModule,
  ],
})
export class Offers implements OnInit {
  private svc    = inject(ProductService);
  private auth   = inject(AuthService);
  private toastr = inject(NbToastrService);

  /** Reactive label dictionary — flips with the tenant's vertical. */
  protected labels = inject(LabelService).labels;

  // ── Service state ─────────────────────────────────────────────────────────
  readonly offers   = computed(() => this.svc.offers());
  readonly products = computed(() => this.svc.products());
  readonly loading  = computed(() => this.svc.loading());
  readonly aiLoading = computed(() => this.svc.aiLoading());
  readonly error    = computed(() => this.svc.error());

  // ── UI state ──────────────────────────────────────────────────────────────
  selectedOffer = signal<TenantOffer | null>(null);
  editMode      = signal(false);
  saving        = signal(false);
  deleting      = signal<string | null>(null);

  // ── Form ──────────────────────────────────────────────────────────────────
  offerForm    = signal<Partial<TenantOffer>>(emptyOffer());
  stackRaw     = signal('');

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
      this.svc.loadOffers(),
      this.svc.loadProducts(),
    ]);
  }

  // ── Selection ─────────────────────────────────────────────────────────────
  selectOffer(o: TenantOffer) {
    this.selectedOffer.set(o);
    this.offerForm.set({ ...o });
    this.stackRaw.set((o.stack_items ?? []).join('\n'));
    this.editMode.set(false);
    this.clearAi();
  }

  // ── CRUD ──────────────────────────────────────────────────────────────────
  openNew() {
    this.selectedOffer.set(null);
    this.offerForm.set(emptyOffer());
    this.stackRaw.set('');
    this.editMode.set(true);
    this.clearAi();
  }

  editOffer() {
    this.editMode.set(true);
    this.clearAi();
  }

  cancelEdit() {
    if (this.selectedOffer()) {
      this.offerForm.set({ ...this.selectedOffer()! });
      this.stackRaw.set((this.selectedOffer()!.stack_items ?? []).join('\n'));
    }
    this.editMode.set(false);
    this.clearAi();
  }

  setField(key: keyof TenantOffer, val: any) {
    this.offerForm.update(f => ({ ...f, [key]: val }));
  }

  onStackChange(raw: string) {
    this.stackRaw.set(raw);
    this.offerForm.update(f => ({ ...f, stack_items: raw.split('\n').map(s => s.trim()).filter(Boolean) }));
  }

  async saveOffer() {
    const form = this.offerForm();
    if (!form.name?.trim()) {
      this.toastr.danger('Offer name is required.', 'Validation');
      return;
    }
    this.saving.set(true);
    const result = (form as any).id
      ? await this.svc.updateOffer((form as any).id, form)
      : await this.svc.createOffer(form);
    this.saving.set(false);
    if (result) {
      this.selectedOffer.set(result);
      this.offerForm.set({ ...result });
      this.stackRaw.set((result.stack_items ?? []).join('\n'));
      this.editMode.set(false);
      this.clearAi();
      this.toastr.success('Offer saved.', 'Saved');
    } else {
      this.toastr.danger(this.svc.error() ?? 'Error saving.', 'Error');
    }
  }

  async deleteOffer(id: string) {
    if (!confirm('Delete this offer? This cannot be undone.')) return;
    this.deleting.set(id);
    const ok = await this.svc.deleteOffer(id);
    this.deleting.set(null);
    if (ok) {
      if (this.selectedOffer()?.id === id) this.selectedOffer.set(null);
      this.toastr.success('Deleted.', 'Deleted');
    } else {
      this.toastr.danger('Failed to delete.', 'Error');
    }
  }

  // ── AI ────────────────────────────────────────────────────────────────────
  async askAi() {
    this.clearAi();
    const res = await this.svc.getAiRecommendation(
      'offer', this.offerForm() as Record<string, any>, this.tenantCtx);
    this.aiFlagged.set(res.flagged);
    this.aiFlagReason.set(res.flag_reason ?? '');
    this.aiSuggestion.set(res.suggestion);
  }

  acceptAiSuggestion() {
    const s = this.aiSuggestion();
    if (!s) return;
    if (s['stack_items']) this.stackRaw.set((s['stack_items'] as string[]).join('\n'));
    this.offerForm.update(f => ({ ...f, ...s }));
    this.clearAi();
    this.toastr.success('AI suggestion applied. Review and save.', 'Applied');
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
