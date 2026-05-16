export type NotifType = 'info' | 'success' | 'warn' | 'danger';

export interface Notif {
  id: number;
  icon: string;
  title: string;
  msg: string;
  type: NotifType;
}

let notifs = $state<Notif[]>([]);
let _id = 0;

export const notifStore = {
  get list() { return notifs; },

  add(icon: string, title: string, msg: string, type: NotifType = 'info', duration = 4000) {
    const id = _id++;
    notifs = [...notifs, { id, icon, title, msg, type }];
    if (duration > 0) setTimeout(() => this.remove(id), duration);
  },

  remove(id: number) {
    notifs = notifs.filter(n => n.id !== id);
  },

  clear() {
    notifs = [];
  }
};
