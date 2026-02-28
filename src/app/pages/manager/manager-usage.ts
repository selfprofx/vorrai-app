import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  NbCardModule, NbButtonModule, NbSelectModule, NbSpinnerModule,
  NbAlertModule, NbBadgeModule, NbIconModule,
} from '@nebular/theme';
import { TokenUsageService } from '../../libs/service/token-usage.service';
import type { TokenUsageRecord } from '../../libs/model/token-usage';

interface DaySummary {
  date: string;
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  estimated_cost_usd: number;
  records: number;
}

@Component({
  selector: 'manager-usage',
  templateUrl: './manager-usage.html',
  styleUrl:    './manager-usage.scss',
  imports: [CommonModule, FormsModule, DecimalPipe,
    NbCardModule, NbButtonModule, NbSelectModule, NbSpinnerModule,
    NbAlertModule, NbBadgeModule, NbIconModule],
})
export class ManagerUsage implements OnInit {
  readonly usageService = inject(TokenUsageService);

  selectedDays   = '30';
  selectedSource = '';

  readonly dayOptions = [
    { label: 'Last 7 days',  value: '7'  },
    { label: 'Last 30 days', value: '30' },
    { label: 'Last 90 days', value: '90' },
    { label: 'All time',     value: ''   },
  ];

  readonly sourceOptions = [
    { label: 'All sources',    value: ''              },
    { label: 'Agent flows',    value: 'agent_flow'    },
    { label: 'Followup flows', value: 'followup_flow' },
    { label: 'Web chat',       value: 'web_chat'      },
  ];

  readonly byDay = computed<DaySummary[]>(() => {
    const items = this.usageService.data()?.items ?? [];
    const map = new Map<string, DaySummary>();
    for (const r of items) {
      const date = (r.created_at ?? '').slice(0, 10);
      if (!date) continue;
      const existing = map.get(date) ?? {
        date, input_tokens: 0, output_tokens: 0,
        total_tokens: 0, estimated_cost_usd: 0, records: 0,
      };
      existing.input_tokens       += r.input_tokens;
      existing.output_tokens      += r.output_tokens;
      existing.total_tokens       += r.total_tokens;
      existing.estimated_cost_usd += r.estimated_cost_usd;
      existing.records++;
      map.set(date, existing);
    }
    return Array.from(map.values()).sort((a, b) => b.date.localeCompare(a.date));
  });

  readonly maxDayTokens = computed(() =>
    Math.max(1, ...this.byDay().map(d => d.total_tokens))
  );

  barWidth(day: DaySummary): number {
    return Math.round((day.total_tokens / this.maxDayTokens()) * 100);
  }

  sourceLabel(source: string | null | undefined): string {
    return this.sourceOptions.find(o => o.value === (source ?? ''))?.label ?? source ?? '—';
  }

  async ngOnInit() {
    await this.load();
  }

  async load() {
    const days   = this.selectedDays   ? parseInt(this.selectedDays)   : undefined;
    const source = this.selectedSource ? this.selectedSource           : undefined;
    await this.usageService.load(days, source);
  }
}
