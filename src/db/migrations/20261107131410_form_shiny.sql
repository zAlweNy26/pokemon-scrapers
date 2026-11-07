CREATE TABLE `form_shiny` (
	`form_id` integer NOT NULL,
	`generation` integer NOT NULL,
	`status` text NOT NULL,
	`games` text,
	PRIMARY KEY(`form_id`, `generation`),
	FOREIGN KEY (`form_id`) REFERENCES `form`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`generation`) REFERENCES `generation`(`id`) ON UPDATE no action ON DELETE no action
);
