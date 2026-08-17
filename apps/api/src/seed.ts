import { and, eq } from "drizzle-orm";
import { db } from "./db";
import { category, room } from "./schema";

// Current rooms + 分區 (fresh DB only). Idempotent: skips when rooms exist. Existing DBs: set zone in admin.
export const ROOMS: [string, string, string][] = [
  // [name, zone, colorToken] — 同區域同色系（tokens.css）：地下室藍 / 1樓紅橘 / 2樓黃 / 活動中心綠 / 3樓紫 / 頂樓紫紅
  ["地下室", "地下1樓", "room-1"], ["玻璃屋", "地下1樓", "room-2"],
  ["蒙式角落", "1樓", "room-3"], ["相談室", "1樓", "room-4"], ["副堂", "1樓", "room-5"],
  ["正堂", "2樓", "room-6"],
  ["活動中心大", "活動中心", "room-7"], ["活動中心中", "活動中心", "room-8"], ["活動中心小", "活動中心", "room-9"],
  ["圖書室", "3樓", "room-11"], ["禱告室", "頂樓", "room-12"],
];
export const CATEGORIES: [string, string][] = [
  ["教會", "cat-church"], ["小組", "cat-group"], ["青少契", "cat-youth"], ["社青", "cat-young"],
  ["兒童", "cat-kids"], ["個人", "cat-personal"],
];

export async function seed() {
  if ((await db.select().from(room).limit(1)).length) {
    // 既有 DB 曾用 room-${i%10+1} 依序上色 → 圖書室=room-10、禱告室=room-1；改成分區色後對齊（只動還是預設 token 的）
    await db.update(room).set({ colorToken: "room-11" }).where(and(eq(room.name, "圖書室"), eq(room.colorToken, "room-10")));
    await db.update(room).set({ colorToken: "room-12" }).where(and(eq(room.name, "禱告室"), eq(room.colorToken, "room-1")));
    return;
  }
  await db.insert(room).values(ROOMS.map(([name, zone, colorToken], i) => ({ name, zone, colorToken, sort: i })));
  await db.insert(category).values(CATEGORIES.map(([name, colorToken], i) => ({ name, colorToken, sort: i })));
}
