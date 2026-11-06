CREATE TABLE `evolution` (
	`id` integer PRIMARY KEY NOT NULL,
	`from_ndex` integer NOT NULL,
	`ndex` integer NOT NULL,
	`from_form_id` integer,
	`into_form_id` integer,
	`trigger` text NOT NULL,
	`game` text NOT NULL,
	`is_default` integer DEFAULT false NOT NULL,
	`conditions` text NOT NULL,
	FOREIGN KEY (`from_ndex`) REFERENCES `pokemon`(`ndex`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`ndex`) REFERENCES `pokemon`(`ndex`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`from_form_id`) REFERENCES `form`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`into_form_id`) REFERENCES `form`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `evolution_from_idx` ON `evolution` (`from_ndex`);--> statement-breakpoint
CREATE INDEX `evolution_ndex_idx` ON `evolution` (`ndex`);--> statement-breakpoint
CREATE TABLE `pokemon_dex_number` (
	`ndex` integer NOT NULL,
	`pokedex` text NOT NULL,
	`number` integer NOT NULL,
	PRIMARY KEY(`ndex`, `pokedex`),
	FOREIGN KEY (`ndex`) REFERENCES `pokemon`(`ndex`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
ALTER TABLE `form` ADD `ev_hp` integer;--> statement-breakpoint
ALTER TABLE `form` ADD `ev_atk` integer;--> statement-breakpoint
ALTER TABLE `form` ADD `ev_def` integer;--> statement-breakpoint
ALTER TABLE `form` ADD `ev_sp_atk` integer;--> statement-breakpoint
ALTER TABLE `form` ADD `ev_sp_def` integer;--> statement-breakpoint
ALTER TABLE `form` ADD `ev_spd` integer;--> statement-breakpoint
ALTER TABLE `form` ADD `base_experience` integer;--> statement-breakpoint
ALTER TABLE `pokemon` ADD `evolution_chain` integer NOT NULL;--> statement-breakpoint
ALTER TABLE `pokemon` ADD `is_legendary` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `pokemon` ADD `is_mythical` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `pokemon` ADD `is_baby` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `pokemon` ADD `has_gender_differences` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `pokemon` ADD `forms_switchable` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `pokemon` ADD `growth_rate` text NOT NULL;--> statement-breakpoint
ALTER TABLE `pokemon` ADD `color` text NOT NULL;--> statement-breakpoint
ALTER TABLE `pokemon` ADD `shape` text NOT NULL;--> statement-breakpoint
ALTER TABLE `pokemon` ADD `habitat` text;--> statement-breakpoint
CREATE INDEX `pokemon_evolution_chain_idx` ON `pokemon` (`evolution_chain`);