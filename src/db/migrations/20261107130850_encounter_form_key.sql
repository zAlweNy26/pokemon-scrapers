-- void:allow-destructive
-- encounter holds only build output: every data load deletes and refills it, so clearing and rebuilding it loses nothing.
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_encounter` (
	`ndex` integer NOT NULL,
	`form_id` integer NOT NULL,
	`game` text NOT NULL,
	`location` text NOT NULL,
	`method` text NOT NULL,
	PRIMARY KEY(`ndex`, `form_id`, `game`, `location`, `method`),
	FOREIGN KEY (`ndex`) REFERENCES `pokemon`(`ndex`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`form_id`) REFERENCES `form`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_encounter`("ndex", "form_id", "game", "location", "method") SELECT "ndex", "form_id", "game", "location", "method" FROM `encounter`;--> statement-breakpoint
DROP TABLE `encounter`;--> statement-breakpoint
ALTER TABLE `__new_encounter` RENAME TO `encounter`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `encounter_form_idx` ON `encounter` (`form_id`);