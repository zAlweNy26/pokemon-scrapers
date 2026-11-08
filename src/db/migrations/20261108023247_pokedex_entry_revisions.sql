CREATE TABLE `pokedex_entry_revision` (
	`ndex` integer NOT NULL,
	`form` text DEFAULT '' NOT NULL,
	`game` text NOT NULL,
	`revision` text NOT NULL,
	`text` text NOT NULL,
	PRIMARY KEY(`ndex`, `form`, `game`, `revision`),
	FOREIGN KEY (`ndex`) REFERENCES `pokemon`(`ndex`) ON UPDATE no action ON DELETE no action
);
