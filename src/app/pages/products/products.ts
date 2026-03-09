import {
  Component, OnInit, signal, computed, inject,
} from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  NbCardModule, NbButtonModule, NbInputModule, NbIconModule,
  NbBadgeModule, NbTabsetModule, NbAlertModule, NbToastrService,
  NbSpinnerModule, NbTagModule,
} from '@nebular/theme';
import { ProductService } from '../../libs/service/product.service';
import { AuthService } from '../../libs/service/auth.service';
import type { Product, Persona, TenantOffer } from '../../libs/model/product';

type ActiveTab = 'info' | 'personas' | 'offers' | 'utm';
type EditMode = 'product' | 'persona' | 'offer' | null;

function emptyProduct(): Partial<Product> {
  return { name: '', description: '', category: '', price: '', currency: 'USD',
           transformation: '', pain_points: '', utm_campaign: '' };
}
function emptyPersona(productId = ''): Partial<Persona> {
  return { name: '', description: '', pain_points: '', demographics: '',
           desires: '', utm_persona: '', product_id: productId };
}
function emptyOffer(productId = ''): Partial<TenantOffer> {
  return { name: '', headline: '', subheadline: '', description: '',
           guarantee: '30-day money-back guarantee.', price_usd: '',
           stack_items: [], utm_content: '', product_id: productId };
}

@Component({
  selector: 'app-products',
  templateUrl: './products.html',
  styleUrl: './products.scss',
  imports: [
    CommonModule, FormsModule, DatePipe,
    NbCardModule, NbButtonModule, NbInputModule, NbIconModule,
    NbBadgeModule, NbTabsetModule, NbAlertModule, NbSpinnerModule, NbTagModule,
  ],
})
export class Products implements OnInit {
  private svc    = inject(ProductService);
  private auth   = inject(AuthService);
  private toastr = inject(NbToastrService);

  // ── Service state ─────────────────────────────────────────────────────────
  readonly products  = computed(() => this.svc.products());
  readonly personas  = computed(() => this.svc.personas());
  readonly offers    = computed(() => this.svc.offers());
  readonly loading   = computed(() => this.svc.loading());
  readonly aiLoading = computed(() => this.svc.aiLoading());
  readonly error     = computed(() => this.svc.error());

  // ── UI state ──────────────────────────────────────────────────────────────
  selectedProduct = signal<Product | null>(null);
  activeTab       = signal<ActiveTab>('info');
  editMode        = signal<EditMode>(null);
  saving          = signal(false);
  deleting        = signal<string | null>(null);

  // ── Forms ─────────────────────────────────────────────────────────────────
  productForm   = signal<Partial<Product>>(emptyProduct());
  personaForm   = signal<Partial<Persona>>(emptyPersona());
  offerForm     = signal<Partial<TenantOffer>>(emptyOffer());
  offerStackRaw = signal('');

  // ── AI ────────────────────────────────────────────────────────────────────
  aiSuggestion     = signal<Record<string, any> | null>(null);
  aiFlagged        = signal(false);
  aiFlagReason     = signal('');
  aiSuggestionType = signal<'product' | 'persona' | 'offer' | null>(null);

  // ── Computed ──────────────────────────────────────────────────────────────
  readonly productPersonas = computed(() => {
    const id = this.selectedProduct()?.id;
    return id ? this.personas().filter(p => p.product_id === id) : this.personas();
  });

  readonly productOffers = computed(() => {
    const id = this.selectedProduct()?.id;
    return id ? this.offers().filter(o => o.product_id === id) : this.offers();
  });

  private get tenantCtx() {
    return { business_name: this.auth.getTenantId() ?? '', description: '', target_persona: '' };
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────
  async ngOnInit() {
    await Promise.all([
      this.svc.loadProducts(),
      this.svc.loadPersonas(),
      this.svc.loadOffers(),
    ]);
  }

  // ── Product CRUD ──────────────────────────────────────────────────────────

  selectProduct(p: Product) {
    this.selectedProduct.set(p);
    this.productForm.set({ ...p });
    this.activeTab.set('info');
    this.editMode.set(null);
    this.clearAi();
  }

  openNewProduct() {
    this.selectedProduct.set(null);
    this.productForm.set(emptyProduct());
    this.activeTab.set('info');
    this.editMode.set('product');
    this.clearAi();
  }

  cancelEdit() {
    if (this.selectedProduct()) this.productForm.set({ ...this.selectedProduct()! });
    this.editMode.set(null);
    this.clearAi();
  }

  setP(key: keyof Product, val: any) { this.productForm.update(f => ({ ...f, [key]: val })); }

  async saveProduct() {
    const form = this.productForm();
    if (!form.name?.trim()) { this.toastr.danger('Product name is required.', 'Validation'); return; }
    this.saving.set(true);
    const result = this.selectedProduct()
      ? await this.svc.updateProduct(this.selectedProduct()!.id, form)
      : await this.svc.createProduct(form);
    this.saving.set(false);
    if (result) {
      this.selectedProduct.set(result);
      this.editMode.set(null);
      this.toastr.success('Product saved.', 'Saved');
    } else {
      this.toastr.danger(this.svc.error() ?? 'Error saving.', 'Error');
    }
  }

  async deleteProduct(id: string) {
    if (!confirm('Delete this product? This cannot be undone.')) return;
    this.deleting.set(id);
    const ok = await this.svc.deleteProduct(id);
    this.deleting.set(null);
    if (ok) {
      if (this.selectedProduct()?.id === id) this.selectedProduct.set(null);
      this.toastr.success('Deleted.', 'Deleted');
    } else {
      this.toastr.danger('Failed to delete.', 'Error');
    }
  }

  // ── Persona CRUD ──────────────────────────────────────────────────────────

  openNewPersona() {
    this.personaForm.set(emptyPersona(this.selectedProduct()?.id));
    this.editMode.set('persona');
    this.clearAi();
  }

  editPersona(p: Persona) { this.personaForm.set({ ...p }); this.editMode.set('persona'); this.clearAi(); }

  setPer(key: keyof Persona, val: any) { this.personaForm.update(f => ({ ...f, [key]: val })); }

  async savePersona() {
    const form = this.personaForm();
    if (!form.name?.trim()) { this.toastr.danger('Persona name is required.', 'Validation'); return; }
    this.saving.set(true);
    const result = (form as any).id
      ? await this.svc.updatePersona((form as any).id, form)
      : await this.svc.createPersona(form);
    this.saving.set(false);
    if (result) { this.editMode.set(null); this.clearAi(); this.toastr.success('Persona saved.', 'Saved'); }
    else this.toastr.danger(this.svc.error() ?? 'Error saving.', 'Error');
  }

  async deletePersona(id: string) {
    if (!confirm('Delete this persona?')) return;
    const ok = await this.svc.deletePersona(id);
    if (ok) this.toastr.success('Deleted.', 'Deleted');
    else this.toastr.danger('Failed to delete.', 'Error');
  }

  // ── Offer CRUD ────────────────────────────────────────────────────────────

  openNewOffer() {
    this.offerForm.set(emptyOffer(this.selectedProduct()?.id));
    this.offerStackRaw.set('');
    this.editMode.set('offer');
    this.clearAi();
  }

  editOffer(o: TenantOffer) {
    this.offerForm.set({ ...o });
    this.offerStackRaw.set((o.stack_items ?? []).join('\n'));
    this.editMode.set('offer');
    this.clearAi();
  }

  setOff(key: keyof TenantOffer, val: any) { this.offerForm.update(f => ({ ...f, [key]: val })); }

  onStackChange(raw: string) {
    this.offerStackRaw.set(raw);
    this.offerForm.update(f => ({ ...f, stack_items: raw.split('\n').map(s => s.trim()).filter(Boolean) }));
  }

  async saveOffer() {
    const form = this.offerForm();
    if (!form.name?.trim()) { this.toastr.danger('Offer name is required.', 'Validation'); return; }
    this.saving.set(true);
    const result = (form as any).id
      ? await this.svc.updateOffer((form as any).id, form)
      : await this.svc.createOffer(form);
    this.saving.set(false);
    if (result) { this.editMode.set(null); this.clearAi(); this.toastr.success('Offer saved.', 'Saved'); }
    else this.toastr.danger(this.svc.error() ?? 'Error saving.', 'Error');
  }

  async deleteOffer(id: string) {
    if (!confirm('Delete this offer?')) return;
    const ok = await this.svc.deleteOffer(id);
    if (ok) this.toastr.success('Deleted.', 'Deleted');
    else this.toastr.danger('Failed to delete.', 'Error');
  }

  // ── AI ────────────────────────────────────────────────────────────────────

  async askAi(type: 'product' | 'persona' | 'offer') {
    this.clearAi();
    const ctx = type === 'product' ? this.productForm()
              : type === 'persona' ? this.personaForm()
              : this.offerForm();
    const res = await this.svc.getAiRecommendation(type, ctx as Record<string, any>, this.tenantCtx);
    this.aiFlagged.set(res.flagged);
    this.aiFlagReason.set(res.flag_reason ?? '');
    this.aiSuggestion.set(res.suggestion);
    this.aiSuggestionType.set(type);
  }

  acceptAiSuggestion() {
    const s = this.aiSuggestion();
    if (!s) return;
    const type = this.aiSuggestionType();
    if (type === 'product') this.productForm.update(f => ({ ...f, ...s }));
    else if (type === 'persona') this.personaForm.update(f => ({ ...f, ...s }));
    else if (type === 'offer') {
      if (s['stack_items']) this.offerStackRaw.set((s['stack_items'] as string[]).join('\n'));
      this.offerForm.update(f => ({ ...f, ...s }));
    }
    this.clearAi();
    this.toastr.success('AI suggestion applied. Review and save.', 'Applied');
  }

  clearAi() {
    this.aiSuggestion.set(null);
    this.aiFlagged.set(false);
    this.aiFlagReason.set('');
    this.aiSuggestionType.set(null);
  }

  aiEntries(): [string, any][] {
    const s = this.aiSuggestion();
    return s ? Object.entries(s).filter(([, v]) => v != null) : [];
  }

  // ── UTM ───────────────────────────────────────────────────────────────────

  buildUtmUrl(base: string, product?: Product | null, persona?: Persona | null, offer?: TenantOffer | null): string {
    const params = new URLSearchParams();
    params.set('utm_source', 'instagram');
    params.set('utm_medium', 'cpc');
    if (product?.utm_campaign) params.set('utm_campaign', product.utm_campaign);
    if (persona?.utm_persona)  params.set('utm_persona', persona.utm_persona);
    if (offer?.utm_content)    params.set('utm_content', offer.utm_content);
    return `${base || 'https://yourlandingpage.com/'}?${params.toString()}`;
  }

  trackBy(_: number, item: any) { return item.id; }

  /** Safely parse dates that may have double timezone (+00:00Z). */
  safeDate(val: string | null | undefined): Date | null {
    if (!val) return null;
    const d = new Date(val.replace('+00:00Z', 'Z'));
    return isNaN(d.getTime()) ? null : d;
  }
}
