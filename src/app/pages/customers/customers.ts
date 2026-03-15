import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TableModule } from 'primeng/table';
import { Tag } from 'primeng/tag';
import { InputTextModule } from 'primeng/inputtext';
import { IconField } from 'primeng/iconfield';
import { InputIcon } from 'primeng/inputicon';
import { ButtonModule } from 'primeng/button';
import { SkeletonModule } from 'primeng/skeleton';
import { NbCardModule, NbSpinnerModule, NbBadgeModule } from '@nebular/theme';

import { CustomerService, type Customer } from '../../libs/service/customer.service';

type Severity = 'success' | 'danger' | 'info' | 'secondary' | 'warn' | 'contrast';

@Component({
  selector: 'app-customers',
  imports: [
    CommonModule, FormsModule,
    TableModule, Tag, InputTextModule, IconField, InputIcon,
    ButtonModule, SkeletonModule,
    NbCardModule, NbSpinnerModule, NbBadgeModule,
  ],
  templateUrl: './customers.html',
  styleUrl: './customers.scss',
})
export class Customers implements OnInit {
  private customerService = inject(CustomerService);

  customers = signal<Customer[]>([]);
  loading = signal(true);
  error = signal<string | null>(null);
  searchTerm = '';

  async ngOnInit() {
    await this.loadCustomers();
  }

  async loadCustomers() {
    this.loading.set(true);
    this.error.set(null);
    try {
      const res = await this.customerService.listCustomers();
      this.customers.set(res.customers);
    } catch (e: any) {
      this.error.set(e?.error?.message || 'Failed to load customers');
    } finally {
      this.loading.set(false);
    }
  }

  lifecycleSeverity(stage: string): Severity {
    switch (stage) {
      case 'onboarding': return 'info';
      case 'active':     return 'success';
      case 'at_risk':    return 'warn';
      case 'churned':    return 'danger';
      default:           return 'secondary';
    }
  }

  npsSeverity(score: number | null): Severity {
    if (score === null || score === undefined) return 'secondary';
    if (score >= 9) return 'success';
    if (score >= 7) return 'warn';
    return 'danger';
  }

  npsLabel(score: number | null): string {
    if (score === null || score === undefined) return 'N/A';
    if (score >= 9) return `${score} Promoter`;
    if (score >= 7) return `${score} Passive`;
    return `${score} Detractor`;
  }

  testimonialSeverity(status: string): Severity {
    switch (status) {
      case 'approved':  return 'success';
      case 'submitted': return 'info';
      case 'requested': return 'warn';
      default:          return 'secondary';
    }
  }
}
