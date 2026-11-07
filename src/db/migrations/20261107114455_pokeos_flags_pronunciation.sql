ALTER TABLE `form` ADD `is_shiny_locked` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `pokemon` ADD `is_sub_legendary` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `pokemon` ADD `is_ultra_beast` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `pokemon` ADD `is_paradox` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `pokemon` ADD `pronunciation` text;--> statement-breakpoint
ALTER TABLE `pokemon` ADD `pronunciation_ipa` text;