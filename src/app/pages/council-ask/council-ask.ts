import {
  Component, OnInit, signal, computed, inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import {
  NbCardModule, NbButtonModule, NbInputModule, NbIconModule,
  NbSpinnerModule, NbToastrService, NbRadioModule, NbCheckboxModule,
} from '@nebular/theme';
import { CouncilService } from '../../libs/service/council.service';
import type { CouncilExpert, CouncilRouteMode } from '../../libs/model/council';
import { DOMAIN_CREWS } from '../../libs/model/council';

@Component({
  selector: 'app-council-ask',
  templateUrl: './council-ask.html',
  styleUrl: './council-ask.scss',
  imports: [
    CommonModule, FormsModule, RouterLink,
    NbCardModule, NbButtonModule, NbInputModule, NbIconModule,
    NbSpinnerModule, NbRadioModule, NbCheckboxModule,
  ],
})
export class CouncilAsk implements OnInit {
  private svc    = inject(CouncilService);
  private router = inject(Router);
  private toastr = inject(NbToastrService);

  // ── State ─────────────────────────────────────────────────────────────────
  readonly experts  = computed(() => this.svc.experts());
  readonly loading  = computed(() => this.svc.loading());

  question     = signal('');
  routeMode    = signal<CouncilRouteMode>('auto');
  submitting   = signal(false);

  // Domain selection
  selectedDomains = signal<Set<string>>(new Set());
  readonly domains = DOMAIN_CREWS;

  // Expert selection
  selectedExperts = signal<Set<string>>(new Set());
  readonly expertsByDomain = computed(() => {
    const map = new Map<string, CouncilExpert[]>();
    for (const e of this.experts()) {
      const list = map.get(e.domain_crew) ?? [];
      list.push(e);
      map.set(e.domain_crew, list);
    }
    return map;
  });

  // ── Lifecycle ─────────────────────────────────────────────────────────────
  async ngOnInit() {
    await this.svc.loadExperts();
  }

  // ── Domain toggles ────────────────────────────────────────────────────────
  toggleDomain(domain: string) {
    this.selectedDomains.update((set) => {
      const next = new Set(set);
      if (next.has(domain)) { next.delete(domain); } else { next.add(domain); }
      return next;
    });
  }

  isDomainSelected(domain: string): boolean {
    return this.selectedDomains().has(domain);
  }

  // ── Expert toggles ────────────────────────────────────────────────────────
  toggleExpert(expertId: string) {
    this.selectedExperts.update((set) => {
      const next = new Set(set);
      if (next.has(expertId)) { next.delete(expertId); } else { next.add(expertId); }
      return next;
    });
  }

  isExpertSelected(expertId: string): boolean {
    return this.selectedExperts().has(expertId);
  }

  // ── Submit ────────────────────────────────────────────────────────────────
  async submit() {
    const q = this.question().trim();
    if (!q) {
      this.toastr.danger('Please enter a question.', 'Validation');
      return;
    }
    if (q.length > 5000) {
      this.toastr.danger('Question exceeds 5000 character limit.', 'Validation');
      return;
    }

    const body: { question: string; selected_experts?: string[]; selected_crews?: string[] } = { question: q };

    const mode = this.routeMode();
    if (mode === 'domains') {
      const crews = [...this.selectedDomains()];
      if (crews.length === 0) {
        this.toastr.danger('Select at least one domain.', 'Validation');
        return;
      }
      body.selected_crews = crews;
    } else if (mode === 'experts') {
      const ids = [...this.selectedExperts()];
      if (ids.length === 0) {
        this.toastr.danger('Select at least one expert.', 'Validation');
        return;
      }
      body.selected_experts = ids;
    }

    this.submitting.set(true);
    const session = await this.svc.createSession(body);
    this.submitting.set(false);

    if (session) {
      this.toastr.success('Session created. The council is processing your question.', 'Submitted');
      this.router.navigate(['/council/sessions']);
    } else {
      this.toastr.danger(this.svc.error() ?? 'Failed to create session.', 'Error');
    }
  }

  getDomainLabel(domain: string): string {
    return this.domains.find(d => d.value === domain)?.label ?? domain;
  }
}
