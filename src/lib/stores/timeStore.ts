import { writable } from 'svelte/store';

export interface ImperialDate {
  year: number;
  month: number; // 1 to 12
  day: number; // 1 to 33
  hour: number; // 0 to 23
  minute: number; // 0 to 59
}

const INITIAL_DATE: ImperialDate = {
  year: 2522,
  month: 1, // Nachexen
  day: 1,
  hour: 8,
  minute: 0
};

export const timeStore = writable<ImperialDate>(INITIAL_DATE);

export const IMPERIAL_MONTHS = [
  { name: 'Nachexen', days: 32 },
  { name: 'Jahrdrung', days: 33 },
  { name: 'Pflugzeit', days: 33 },
  { name: 'Sigmarzeit', days: 33 },
  { name: 'Sommerzeit', days: 33 },
  { name: 'Vorgeheim', days: 33 },
  { name: 'Nachgeheim', days: 32 },
  { name: 'Erntezeit', days: 33 },
  { name: 'Brauzeit', days: 33 },
  { name: 'Kaldezeit', days: 33 },
  { name: 'Ulriczeit', days: 33 },
  { name: 'Vorhexen', days: 33 }
];

export function advanceTime(hours: number, minutes: number = 0) {
  timeStore.update(d => {
    let newMin = d.minute + minutes;
    let newHour = d.hour + hours + Math.floor(newMin / 60);
    newMin = newMin % 60;
    
    let daysToAdd = Math.floor(newHour / 24);
    newHour = newHour % 24;

    let newDay = d.day + daysToAdd;
    let newMonth = d.month;
    let newYear = d.year;

    while (true) {
      let currentMonthDays = IMPERIAL_MONTHS[newMonth - 1].days;
      if (newDay <= currentMonthDays) {
        break;
      }
      newDay -= currentMonthDays;
      newMonth++;
      if (newMonth > 12) {
        newMonth = 1;
        newYear++;
      }
    }

    return {
      year: newYear,
      month: newMonth,
      day: newDay,
      hour: newHour,
      minute: newMin
    };
  });
}

export function formatImperialDate(d: ImperialDate): string {
  const monthName = IMPERIAL_MONTHS[d.month - 1].name;
  return `${d.day} ${monthName} ${d.year} - ${d.hour.toString().padStart(2, '0')}:${d.minute.toString().padStart(2, '0')}`;
}
