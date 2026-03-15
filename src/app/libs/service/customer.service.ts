import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface Customer {
  customer_email: string;
  customer_name: string | null;
  product_slug: string | null;
  purchase_date: string | null;
  onboarding_status: string;
  lifecycle_stage: string;
  satisfaction_score: number | null;
  nps_score: number | null;
  testimonial_status: string;
  postsale_chat_state: string | null;
  last_checkin_at: string | null;
  created_at: string;
}

export interface CustomerDetail extends Customer {
  phone: string | null;
  testimonial_s3_key: string | null;
  updated_at: string | null;
}

@Injectable({ providedIn: 'root' })
export class CustomerService {
  private http = inject(HttpClient);
  private base = environment.apiUrl;

  listCustomers(): Promise<{ customers: Customer[] }> {
    return firstValueFrom(
      this.http.get<{ customers: Customer[] }>(`${this.base}/dashboard/customers`)
    );
  }

  getCustomer(customerEmail: string): Promise<CustomerDetail> {
    return firstValueFrom(
      this.http.get<CustomerDetail>(`${this.base}/dashboard/customers/${encodeURIComponent(customerEmail)}`)
    );
  }
}
