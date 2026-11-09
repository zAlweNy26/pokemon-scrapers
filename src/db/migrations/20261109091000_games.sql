CREATE TABLE `game` (
	`slug` text PRIMARY KEY NOT NULL,
	`version_group` text NOT NULL,
	`generation` integer NOT NULL,
	`base_game` text,
	`sort` integer NOT NULL,
	`name_en` text NOT NULL,
	`name_ja` text,
	`name_ja_romaji` text,
	`name_de` text,
	`name_fr` text,
	`name_it` text,
	`name_es` text,
	`name_ko` text,
	`name_zh_hans` text,
	`name_zh_hant` text,
	FOREIGN KEY (`generation`) REFERENCES `generation`(`id`) ON UPDATE no action ON DELETE no action
);
