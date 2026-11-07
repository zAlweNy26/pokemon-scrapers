ALTER TABLE `form` ADD `category` text DEFAULT 'default' NOT NULL;--> statement-breakpoint
CREATE INDEX `form_category_idx` ON `form` (`category`);