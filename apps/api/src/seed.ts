import { db } from "./db";
import { category, room } from "./schema";

// Old const.ts lists → DB rows (id order preserved). Idempotent: skips when rooms exist.
export const ROOMS = [
  "地下室大", "地下室小", "協談室", "兒童室", "副堂", "正堂", "活動中心大", "活動中心小", "圖書室", "禱告室",
];
export const CATEGORIES: [string, string][] = [
  ["教會", "cat-church"], ["小組", "cat-group"], ["青少契", "cat-youth"], ["社青", "cat-young"],
  ["兒童", "cat-kids"], ["個人", "cat-personal"],
];

export async function seed() {
  if ((await db.select().from(room).limit(1)).length) return;
  await db.insert(room).values(ROOMS.map((name, i) => ({ name, colorToken: `room-${i + 1}`, sort: i })));
  await db.insert(category).values(CATEGORIES.map(([name, colorToken], i) => ({ name, colorToken, sort: i })));
}
