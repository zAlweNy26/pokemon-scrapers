CREATE TABLE `encounter` (
	`ndex` integer NOT NULL,
	`game` text NOT NULL,
	`location` text NOT NULL,
	`method` text,
	FOREIGN KEY (`ndex`) REFERENCES `pokemon`(`ndex`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `encounter_ndex_idx` ON `encounter` (`ndex`);--> statement-breakpoint
CREATE TABLE `form` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`ndex` integer NOT NULL,
	`slug` text NOT NULL,
	`name_en` text NOT NULL,
	`is_default` integer DEFAULT false NOT NULL,
	`depositable` integer DEFAULT false NOT NULL,
	`height_m` real,
	`weight_kg` real,
	`hp` integer,
	`atk` integer,
	`def` integer,
	`sp_atk` integer,
	`sp_def` integer,
	`spd` integer,
	`sprite_key` text,
	FOREIGN KEY (`ndex`) REFERENCES `pokemon`(`ndex`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `form_slug_unique` ON `form` (`slug`);--> statement-breakpoint
CREATE INDEX `form_ndex_idx` ON `form` (`ndex`);--> statement-breakpoint
CREATE INDEX `form_depositable_idx` ON `form` (`depositable`);--> statement-breakpoint
CREATE TABLE `form_ability` (
	`form_id` integer NOT NULL,
	`slot` integer NOT NULL,
	`ability` text NOT NULL,
	`is_hidden` integer DEFAULT false NOT NULL,
	PRIMARY KEY(`form_id`, `slot`),
	FOREIGN KEY (`form_id`) REFERENCES `form`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `form_type` (
	`form_id` integer NOT NULL,
	`slot` integer NOT NULL,
	`type` text NOT NULL,
	PRIMARY KEY(`form_id`, `slot`),
	FOREIGN KEY (`form_id`) REFERENCES `form`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `form_type_type_idx` ON `form_type` (`type`);--> statement-breakpoint
CREATE TABLE `generation` (
	`id` integer PRIMARY KEY NOT NULL,
	`region` text NOT NULL,
	`debut` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `meta` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `pokemon` (
	`ndex` integer PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`gen` integer NOT NULL,
	`category` text,
	`catch_rate` integer,
	`base_friendship` integer,
	`gender_rate` integer,
	`egg_cycles` integer,
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
	FOREIGN KEY (`gen`) REFERENCES `generation`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `pokemon_slug_unique` ON `pokemon` (`slug`);--> statement-breakpoint
CREATE INDEX `pokemon_gen_idx` ON `pokemon` (`gen`);--> statement-breakpoint
CREATE INDEX `pokemon_name_idx` ON `pokemon` (`name_en`);--> statement-breakpoint
CREATE TABLE `pokemon_egg_group` (
	`ndex` integer NOT NULL,
	`egg_group` text NOT NULL,
	PRIMARY KEY(`ndex`, `egg_group`),
	FOREIGN KEY (`ndex`) REFERENCES `pokemon`(`ndex`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `pokemon_origin` (
	`ndex` integer NOT NULL,
	`lang` text NOT NULL,
	`note` text NOT NULL,
	PRIMARY KEY(`ndex`, `lang`),
	FOREIGN KEY (`ndex`) REFERENCES `pokemon`(`ndex`) ON UPDATE no action ON DELETE no action
);
