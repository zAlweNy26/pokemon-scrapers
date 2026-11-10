CREATE TABLE `pokedex` (
	`slug` text PRIMARY KEY NOT NULL,
	`region` text,
	`main_series` integer NOT NULL,
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
CREATE TABLE `pokedex_game` (
	`pokedex` text NOT NULL,
	`version_group` text NOT NULL,
	PRIMARY KEY(`pokedex`, `version_group`),
	FOREIGN KEY (`pokedex`) REFERENCES `pokedex`(`slug`) ON UPDATE no action ON DELETE no action
);
