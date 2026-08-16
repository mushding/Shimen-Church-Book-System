// ponytail: fake data for POC only
export const ROOMS = [
  { id: 1, name: "地下室大" }, { id: 2, name: "地下室小" }, { id: 3, name: "協談室" },
  { id: 4, name: "兒童室" }, { id: 5, name: "副堂" }, { id: 6, name: "正堂" },
  { id: 7, name: "活動中心大" }, { id: 8, name: "活動中心小" }, { id: 9, name: "圖書室" },
  { id: 10, name: "禱告室" },
];

const monday = (() => { const d = new Date(); d.setHours(0,0,0,0); d.setDate(d.getDate() - ((d.getDay()+6)%7)); return d; })();
const at = (dayOff: number, h: number, m = 0) => { const d = new Date(monday); d.setDate(d.getDate()+dayOff); d.setHours(h,m,0,0); return d; };
const iso = (d: Date) => d.toISOString();

export type Booking = {
  id: string; title: string; roomId: number; user: string;
  start?: string; end?: string;
  rrule?: string | object; duration?: string; exdate?: string[];
};

export const BOOKINGS: Booking[] = [
  // 一次性
  ...Array.from({ length: 40 }, (_, i) => {
    const day = i % 7, room = (i % 10) + 1, h = 9 + (i * 3) % 11;
    return { id: `b${i}`, title: `登記 ${i}`, roomId: room, user: "小明", start: iso(at(day, h)), end: iso(at(day, h + 1, 30)) };
  }),
  // 週期：每週日 09:00 主日崇拜（正堂）+ 一個 EXDATE
  {
    id: "s1", title: "主日崇拜", roomId: 6, user: "教會",
    rrule: `DTSTART:${at(6, 9).toISOString().replace(/[-:]|\.\d{3}/g, "")}\nRRULE:FREQ=WEEKLY;BYDAY=SU`,
    duration: "02:00",
    exdate: [iso(at(13, 9))],
  },
  // 週期：每月第一個週六 青少契（活動中心大），物件寫法
  {
    id: "s2", title: "青少契月聚", roomId: 7, user: "青少契",
    rrule: { freq: "monthly", byweekday: [{ weekday: 5, n: 1 }], dtstart: iso(at(5, 19)) },
    duration: "03:00",
  },
];
