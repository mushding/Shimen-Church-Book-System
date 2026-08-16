UPDATE "room" SET "zone" = '地下1樓' WHERE "zone" IS NULL AND "name" IN ('地下室', '地下室大', '地下室小', '玻璃屋');
--> statement-breakpoint
UPDATE "room" SET "zone" = '1樓' WHERE "zone" IS NULL AND "name" IN ('蒙式角落', '相談室', '協談室', '副堂', '兒童室');
--> statement-breakpoint
UPDATE "room" SET "zone" = '2樓' WHERE "zone" IS NULL AND "name" IN ('正堂');
--> statement-breakpoint
UPDATE "room" SET "zone" = '活動中心' WHERE "zone" IS NULL AND "name" LIKE '活動中心%';
--> statement-breakpoint
UPDATE "room" SET "zone" = '3樓' WHERE "zone" IS NULL AND "name" IN ('圖書室');
--> statement-breakpoint
UPDATE "room" SET "zone" = '頂樓' WHERE "zone" IS NULL AND "name" IN ('禱告室');
