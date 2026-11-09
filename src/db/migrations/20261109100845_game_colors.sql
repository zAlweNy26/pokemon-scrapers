-- void:allow-destructive
-- SQLite refuses a NOT NULL column without a default on a table with rows; `data:load:remote` refills game right after migrating.
DELETE FROM `game`;--> statement-breakpoint
ALTER TABLE `game` ADD `color` text NOT NULL;
