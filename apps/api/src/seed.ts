import { db } from "./db";
import { category, room } from "./schema";

// Current rooms + 分區 (fresh DB only). Idempotent: skips when rooms exist. Existing DBs: set zone in admin.
export const ROOMS: [string, string][] = [
  ["地下室", "地下1樓"], ["玻璃屋", "地下1樓"], ["蒙式角落", "1樓"], ["相談室", "1樓"], ["副堂", "1樓"], ["正堂", "2樓"],
  ["活動中心大", "活動中心"], ["活動中心中", "活動中心"], ["活動中心小", "活動中心"], ["圖書室", "3樓"], ["禱告室", "頂樓"],
];
export const CATEGORIES: [string, string][] = [
  ["教會", "cat-church"], ["小組", "cat-group"], ["青少契", "cat-youth"], ["社青", "cat-young"],
  ["兒童", "cat-kids"], ["個人", "cat-personal"],
];

export async function seed() {
  if ((await db.select().from(room).limit(1)).length) return;
  await db.insert(room).values(ROOMS.map(([name, zone], i) => ({ name, zone, colorToken: `room-${(i % 10) + 1}`, sort: i })));
  await db.insert(category).values(CATEGORIES.map(([name, colorToken], i) => ({ name, colorToken, sort: i })));
}
