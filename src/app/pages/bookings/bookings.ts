import { Component } from '@angular/core';
import { FullCalendarModule } from '@fullcalendar/angular';
import { CalendarOptions } from '@fullcalendar/core'; // useful for typechecking
import dayGridPlugin from '@fullcalendar/daygrid';
import { NbCardModule } from '@nebular/theme';

@Component({
  selector: 'bookings',
  imports: [FullCalendarModule, NbCardModule],
  templateUrl: './bookings.html',
  styleUrl: './bookings.scss'
})
export class Bookings {
  
  calendarOptions: CalendarOptions = {
    initialView: 'dayGridMonth',
    plugins: [dayGridPlugin]
  };

}
