CREATE TABLE `availability` (
	`ndex` integer NOT NULL,
	`game` text NOT NULL,
	`dlc` text DEFAULT '' NOT NULL,
	`area` text,
	`obtainable` integer NOT NULL,
	PRIMARY KEY(`ndex`, `game`, `dlc`),
	FOREIGN KEY (`ndex`) REFERENCES `pokemon`(`ndex`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `pokedex_entry` (
	`ndex` integer NOT NULL,
	`form` text DEFAULT '' NOT NULL,
	`game` text NOT NULL,
	`text` text NOT NULL,
	PRIMARY KEY(`ndex`, `form`, `game`),
	FOREIGN KEY (`ndex`) REFERENCES `pokemon`(`ndex`) ON UPDATE no action ON DELETE no action
);
