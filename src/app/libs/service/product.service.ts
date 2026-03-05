import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { AuthService } from './auth.service';
import type { Product, Persona, TenantOffer, AiRecommendation } from '../model/product';
import { environment } from '../../../environments/environment';

const API = environment.apiUrl;

@Injectable({ providedIn: 'root' })
export class ProductService {
  private http = inject(HttpClient);
  private auth = inject(AuthService);

  // ── State ──────────────────────────────────────────────────────────────────
  products  = signal<Product[]>([]);
  personas  = signal<Persona[]>([]);
  offers    = signal<TenantOffer[]>([]);
  loading   = signal(false);
  error     = signal<string | null>(null);
  aiLoading = signal(false);

  // ── Products ───────────────────────────────────────────────────────────────

  async loadProducts(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const res = await firstValueFrom(
        this.http.get<{ items: Product[] }>(`${API}/dashboard/products`, {
          headers: this.auth.authHeader(),
        })
      );
      this.products.set(res.items ?? []);
    } catch (e: any) {
      this.error.set(e?.error?.message ?? 'Failed to load products');
    } finally {
      this.loading.set(false);
    }
  }

  async createProduct(data: Partial<Product>): Promise<Product | null> {
    try {
      const p = await firstValueFrom(
        this.http.post<Product>(`${API}/dashboard/products`, data, {
          headers: this.auth.authHeader(),
        })
      );
      this.products.update(list => [p, ...list]);
      return p;
    } catch (e: any) {
      this.error.set(e?.error?.message ?? 'Failed to create product');
      return null;
    }
  }

  async updateProduct(id: string, data: Partial<Product>): Promise<Product | null> {
    try {
      const p = await firstValueFrom(
        this.http.put<Product>(`${API}/dashboard/products/${id}`, data, {
          headers: this.auth.authHeader(),
        })
      );
      this.products.update(list => list.map(x => x.id === id ? p : x));
      return p;
    } catch (e: any) {
      this.error.set(e?.error?.message ?? 'Failed to update product');
      return null;
    }
  }

  async deleteProduct(id: string): Promise<boolean> {
    try {
      await firstValueFrom(
        this.http.delete(`${API}/dashboard/products/${id}`, {
          headers: this.auth.authHeader(),
        })
      );
      this.products.update(list => list.filter(x => x.id !== id));
      return true;
    } catch (e: any) {
      this.error.set(e?.error?.message ?? 'Failed to delete product');
      return false;
    }
  }

  // ── Personas ───────────────────────────────────────────────────────────────

  async loadPersonas(productId?: string): Promise<void> {
    this.loading.set(true);
    try {
      const params = productId ? `?product_id=${productId}` : '';
      const res = await firstValueFrom(
        this.http.get<{ items: Persona[] }>(`${API}/dashboard/personas${params}`, {
          headers: this.auth.authHeader(),
        })
      );
      this.personas.set(res.items ?? []);
    } catch (e: any) {
      this.error.set(e?.error?.message ?? 'Failed to load personas');
    } finally {
      this.loading.set(false);
    }
  }

  async createPersona(data: Partial<Persona>): Promise<Persona | null> {
    try {
      const p = await firstValueFrom(
        this.http.post<Persona>(`${API}/dashboard/personas`, data, {
          headers: this.auth.authHeader(),
        })
      );
      this.personas.update(list => [p, ...list]);
      return p;
    } catch (e: any) {
      this.error.set(e?.error?.message ?? 'Failed to create persona');
      return null;
    }
  }

  async updatePersona(id: string, data: Partial<Persona>): Promise<Persona | null> {
    try {
      const p = await firstValueFrom(
        this.http.put<Persona>(`${API}/dashboard/personas/${id}`, data, {
          headers: this.auth.authHeader(),
        })
      );
      this.personas.update(list => list.map(x => x.id === id ? p : x));
      return p;
    } catch (e: any) {
      this.error.set(e?.error?.message ?? 'Failed to update persona');
      return null;
    }
  }

  async deletePersona(id: string): Promise<boolean> {
    try {
      await firstValueFrom(
        this.http.delete(`${API}/dashboard/personas/${id}`, {
          headers: this.auth.authHeader(),
        })
      );
      this.personas.update(list => list.filter(x => x.id !== id));
      return true;
    } catch (e: any) {
      this.error.set(e?.error?.message ?? 'Failed to delete persona');
      return false;
    }
  }

  // ── Offers ─────────────────────────────────────────────────────────────────

  async loadOffers(productId?: string): Promise<void> {
    this.loading.set(true);
    try {
      const params = productId ? `?product_id=${productId}` : '';
      const res = await firstValueFrom(
        this.http.get<{ items: TenantOffer[] }>(`${API}/dashboard/offers${params}`, {
          headers: this.auth.authHeader(),
        })
      );
      this.offers.set(res.items ?? []);
    } catch (e: any) {
      this.error.set(e?.error?.message ?? 'Failed to load offers');
    } finally {
      this.loading.set(false);
    }
  }

  async createOffer(data: Partial<TenantOffer>): Promise<TenantOffer | null> {
    try {
      const o = await firstValueFrom(
        this.http.post<TenantOffer>(`${API}/dashboard/offers`, data, {
          headers: this.auth.authHeader(),
        })
      );
      this.offers.update(list => [o, ...list]);
      return o;
    } catch (e: any) {
      this.error.set(e?.error?.message ?? 'Failed to create offer');
      return null;
    }
  }

  async updateOffer(id: string, data: Partial<TenantOffer>): Promise<TenantOffer | null> {
    try {
      const o = await firstValueFrom(
        this.http.put<TenantOffer>(`${API}/dashboard/offers/${id}`, data, {
          headers: this.auth.authHeader(),
        })
      );
      this.offers.update(list => list.map(x => x.id === id ? o : x));
      return o;
    } catch (e: any) {
      this.error.set(e?.error?.message ?? 'Failed to update offer');
      return null;
    }
  }

  async deleteOffer(id: string): Promise<boolean> {
    try {
      await firstValueFrom(
        this.http.delete(`${API}/dashboard/offers/${id}`, {
          headers: this.auth.authHeader(),
        })
      );
      this.offers.update(list => list.filter(x => x.id !== id));
      return true;
    } catch (e: any) {
      this.error.set(e?.error?.message ?? 'Failed to delete offer');
      return false;
    }
  }

  // ── AI Recommendations ─────────────────────────────────────────────────────

  async getAiRecommendation(
    type: 'product' | 'persona' | 'offer',
    context: Record<string, any>,
    tenantContext: { business_name?: string; description?: string; target_persona?: string },
  ): Promise<AiRecommendation> {
    this.aiLoading.set(true);
    try {
      return await firstValueFrom(
        this.http.post<AiRecommendation>(
          `${API}/dashboard/ai/recommend`,
          { type, context, tenant_context: tenantContext },
          { headers: this.auth.authHeader() },
        )
      );
    } catch {
      return { flagged: false, suggestion: null };
    } finally {
      this.aiLoading.set(false);
    }
  }
}
