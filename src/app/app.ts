import { Component, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet } from '@angular/router';
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


@Component({
  selector: 'app-root',
  templateUrl: './app.html',
  styleUrl: './app.scss',

  imports: [
    CommonModule,
    RouterOutlet,
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
  ],
})
export class App implements OnInit {
  protected readonly title = signal('angular-app');

  topMenuItems = [{ title: 'Profile' }, { title: 'Log out' }];

  private readonly BASE_MENU = [
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

    { title: 'Settings', link: '/settings', icon: 'settings-2-outline' },
  ];

  private readonly MANAGER_MENU = [
    { title: 'Manager', group: true },
    { title: 'Overview', link: '/manager', icon: 'monitor-outline' },
    { title: 'All Tenants', link: '/manager/tenants', icon: 'grid-outline' },
  ];

  readonly menuItems = computed(() =>
    this.auth.isManager()
      ? [...this.BASE_MENU, ...this.MANAGER_MENU]
      : this.BASE_MENU
  );

  constructor(
    private nbMenuService: NbMenuService,
    private sidebarService: NbSidebarService,
    protected auth: AuthService,
    private appWs: AppWsService,
  ) {}

  toggleSidebar() {
    this.sidebarService.toggle(false, 'menu-sidebar');
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
        }
      });
  }
}
