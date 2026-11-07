ALTER TABLE `encounter` ADD `form_id` integer REFERENCES form(id);--> statement-breakpoint
-- Old rows have no form; every load replaces the table anyway, and the next
-- migration's rebuild makes form_id NOT NULL, which they would fail.
DELETE FROM `encounter`;
