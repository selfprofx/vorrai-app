import { Component } from '@angular/core';
import { NbCardModule } from '@nebular/theme';
import { ChartModule } from 'primeng/chart';

@Component({
  selector: 'dashboard',
  imports: [NbCardModule, ChartModule],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss'
})
export class Dashboard {

    // basicData: any;

    // basicOptions: any;

    // platformId = inject(PLATFORM_ID);

    // configService = inject(AppConfigService);

    // constructor(private cd: ChangeDetectorRef) {}

    // themeEffect = effect(() => {
    //     if (this.configService.transitionComplete()) {
    //         if (this.designerService.preset()) {
    //             this.initChart();
    //         }
    //     }
    // });

    // ngOnInit() {
    //     this.initChart();
    // }

    // initChart() {
    //     if (isPlatformBrowser(this.platformId)) {
    //         const documentStyle = getComputedStyle(document.documentElement);
    //         const textColor = documentStyle.getPropertyValue('--p-text-color');
    //         const textColorSecondary = documentStyle.getPropertyValue('--p-text-muted-color');
    //         const surfaceBorder = documentStyle.getPropertyValue('--p-content-border-color');

    //         this.basicData = {
    //             labels: ['Q1', 'Q2', 'Q3', 'Q4'],
    //             datasets: [
    //                 {
    //                     label: 'Sales',
    //                     data: [540, 325, 702, 620],
    //                     backgroundColor: [
    //                         'rgba(249, 115, 22, 0.2)',
    //                         'rgba(6, 182, 212, 0.2)',
    //                         'rgb(107, 114, 128, 0.2)',
    //                         'rgba(139, 92, 246, 0.2)',
    //                     ],
    //                     borderColor: ['rgb(249, 115, 22)', 'rgb(6, 182, 212)', 'rgb(107, 114, 128)', 'rgb(139, 92, 246)'],
    //                     borderWidth: 1,
    //                 },
    //             ],
    //         };

    //         this.basicOptions = {
    //             plugins: {
    //                 legend: {
    //                     labels: {
    //                         color: textColor,
    //                     },
    //                 },
    //             },
    //             scales: {
    //                 x: {
    //                     ticks: {
    //                         color: textColorSecondary,
    //                     },
    //                     grid: {
    //                         color: surfaceBorder,
    //                     },
    //                 },
    //                 y: {
    //                     beginAtZero: true,
    //                     ticks: {
    //                         color: textColorSecondary,
    //                     },
    //                     grid: {
    //                         color: surfaceBorder,
    //                     },
    //                 },
    //             },
    //         };
    //         this.cd.markForCheck()
    //     }
    // }

    }