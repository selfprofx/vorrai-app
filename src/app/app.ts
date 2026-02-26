import { Component, signal, OnInit } from '@angular/core';
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


@Component({
  selector: 'app-root',
  templateUrl: './app.html',
  styleUrl: './app.scss',

  imports: [
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
  ],
})
export class App implements OnInit {
  protected readonly title = signal('angular-app');

  topMenuItems = [{ title: 'Profile' }, { title: 'Log out' }];

  menuItems = [
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

    { title: 'Settings', link: '/settings', icon: 'settings-2-outline' },
  ];

  constructor(
    private nbMenuService: NbMenuService,
    private sidebarService: NbSidebarService,
    private auth: AuthService,
  ) {}

  toggleSidebar() {
    this.sidebarService.toggle(false, 'menu-sidebar');
  }

  ngOnInit() {
    this.nbMenuService
      .onItemClick()
      .pipe(
        filter(({ tag }) => tag === 'profile-menu'),
        map(({ item: { title } }) => title),
      )
      .subscribe(async (title) => {
        if (title === 'Log out') {
          await this.auth.signOut();
        }
      });
  }
}
