CREATE TABLE `ability` (
	`slug` text PRIMARY KEY NOT NULL,
	`name_en` text NOT NULL,
	`name_ja` text,
	`name_ja_romaji` text,
	`name_de` text,
	`name_fr` text,
	`name_it` text,
	`name_es` text,
	`name_ko` text,
	`name_zh_hans` text,
	`name_zh_hant` text
);
--> statement-breakpoint
CREATE TABLE `move` (
	`slug` text PRIMARY KEY NOT NULL,
	`name_en` text NOT NULL,
	`name_ja` text,
	`name_ja_romaji` text,
	`name_de` text,
	`name_fr` text,
	`name_it` text,
	`name_es` text,
	`name_ko` text,
	`name_zh_hans` text,
	`name_zh_hant` text
);
--> statement-breakpoint
CREATE TABLE `type` (
	`slug` text PRIMARY KEY NOT NULL,
	`name_en` text NOT NULL,
	`name_ja` text,
	`name_ja_romaji` text,
	`name_de` text,
	`name_fr` text,
	`name_it` text,
	`name_es` text,
	`name_ko` text,
	`name_zh_hans` text,
	`name_zh_hant` text
);
