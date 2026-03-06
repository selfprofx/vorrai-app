import { Component, signal, computed, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink, RouterOutlet } from '@angular/router';
import { NbMenuService } from '@nebular/theme';
import { filter, map } from 'rxjs/operators';

import {
  NbSidebarModule,
  NbLayoutModule,
  NbCardModule,
  NbButtonModule,
  NbIconModule,
  NbSidebarService,
  NbMenuModule,
  NbUserModule,
  NbContextMenuModule,
} from '@nebular/theme';

import { NbEvaIconsModule } from '@nebular/eva-icons';
import { AuthService } from './libs/service/auth.service';
import { AppWsService } from './libs/service/app-ws.service';
import { AiAssistantComponent } from './components/ai-assistant/ai-assistant';
import { NotificationBellComponent } from './components/notification-bell/notification-bell';
import { ThemeService } from './libs/service/theme.service';


@Component({
  selector: 'app-root',
  templateUrl: './app.html',
  styleUrl: './app.scss',

  imports: [
    CommonModule,
    RouterOutlet,
    RouterLink,
    NbLayoutModule,
    NbCardModule,
    NbButtonModule,
    NbIconModule,
    NbEvaIconsModule,
    NbContextMenuModule,
    NbSidebarModule,
    NbUserModule,
    NbMenuModule,
    AiAssistantComponent,
    NotificationBellComponent,
  ],
})
export class App implements OnInit {
  protected readonly title = signal('angular-app');

  topMenuItems = [
    { title: 'Profile', icon: 'person-outline' },
    { title: 'Settings', icon: 'settings-2-outline' },
    { title: 'Log out', icon: 'log-out-outline' },
  ];

  readonly displayName = computed(() => this.auth.displayName() || 'User');

  private themeService = inject(ThemeService);
  readonly themeIcon = computed(() => this.themeService.isDark() ? 'sun-outline' : 'moon-outline');
  readonly themeLabel = computed(() => this.themeService.isDark() ? 'Switch to light mode' : 'Switch to dark mode');

  onThemeToggle(): void {
    this.themeService.toggle();
  }

  private readonly MAIN_MENU = [
    { title: 'Home', group: true },
    { title: 'Dashboard', link: '/dashboard', icon: 'home-outline' },
    { title: 'Bookings', link: '/bookings', icon: 'calendar-outline' },
    { title: 'Leads', link: '/users', icon: 'people-outline' },
    { title: 'Chats', link: '/chats', icon: 'message-circle-outline' },

    { title: 'Management', group: true },
    { title: 'Products', link: '/products', icon: 'cube-outline' },
    { title: 'Contents', link: '/contents', icon: 'book-open-outline' },
    { title: 'Courses', link: '/courses', icon: 'award-outline' },
    { title: 'Council', link: '/council', icon: 'people-outline' },

    { title: 'Followups', group: true },
    { title: 'Followup Emails', link: '/followups', icon: 'email-outline' },
    { title: 'Content Jobs', link: '/content-jobs', icon: 'layers-outline' },
    { title: 'Email Templates', link: '/email-templates', icon: 'email-outline' },
  ];

  private readonly MANAGER_MENU = [
    { title: 'Manager', group: true },
    { title: 'Overview', link: '/manager', icon: 'monitor-outline' },
    { title: 'All Tenants', link: '/manager/tenants', icon: 'grid-outline' },
  ];

  readonly menuItems = computed(() => {
    return this.auth.isManager()
      ? [...this.MAIN_MENU, ...this.MANAGER_MENU]
      : [...this.MAIN_MENU];
  });

  constructor(
    private nbMenuService: NbMenuService,
    private sidebarService: NbSidebarService,
    private router: Router,
    protected auth: AuthService,
    private appWs: AppWsService,
  ) {}

  toggleSidebar() {
    this.sidebarService.getSidebarState('menu-sidebar')
      .subscribe(state => {
        if (state === 'expanded') {
          this.sidebarService.compact('menu-sidebar');
        } else {
          this.sidebarService.expand('menu-sidebar');
        }
      });
  }

  ngOnInit() {
    // Connect the global dashboard WebSocket as soon as the tenant is authenticated
    if (this.auth.isAuthenticated()) {
      this.appWs.connect();
    }

    this.nbMenuService
      .onItemClick()
      .pipe(
        filter(({ tag }) => tag === 'profile-menu'),
        map(({ item: { title } }) => title),
      )
      .subscribe(async (title) => {
        if (title === 'Log out') {
          this.appWs.disconnect();
          await this.auth.signOut();
        } else if (title === 'Profile') {
          this.router.navigate(['/settings'], { queryParams: { tab: 'profile' } });
        } else if (title === 'Settings') {
          this.router.navigate(['/settings'], { queryParams: { tab: 'security' } });
        }
      });
  }
}
