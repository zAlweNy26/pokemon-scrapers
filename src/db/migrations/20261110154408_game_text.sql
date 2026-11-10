-- void:allow-destructive
-- Game text from the games themselves, in every language (CLAUDE.md, "Game text only"); the data load refills it all.
-- The games show no romaji, so every *_ja_romaji column goes. pokemon_fts indexes pokemon.name_ja_romaji,
-- so it is dropped first and rebuilt without it (hand-written, like the original in
-- 20261104113659_initial_schema.sql: drizzle-kit cannot express FTS5).
DROP TABLE `pokemon_fts`;--> statement-breakpoint
ALTER TABLE `ability` DROP COLUMN `name_ja_romaji`;--> statement-breakpoint
ALTER TABLE `form` DROP COLUMN `name_ja_romaji`;--> statement-breakpoint
ALTER TABLE `game` DROP COLUMN `name_ja_romaji`;--> statement-breakpoint
ALTER TABLE `move` DROP COLUMN `name_ja_romaji`;--> statement-breakpoint
ALTER TABLE `pokedex` DROP COLUMN `name_ja_romaji`;--> statement-breakpoint
ALTER TABLE `pokemon` DROP COLUMN `name_ja_romaji`;--> statement-breakpoint
ALTER TABLE `pokemon` DROP COLUMN `category_ja_romaji`;--> statement-breakpoint
ALTER TABLE `type` DROP COLUMN `name_ja_romaji`;--> statement-breakpoint
-- Descriptions and Pokédex entries become one column per language. Bulbapedia's earlier
-- revisions have no game-extracted source, so their table goes.
ALTER TABLE `ability` DROP COLUMN `description`;--> statement-breakpoint
ALTER TABLE `move` DROP COLUMN `description`;--> statement-breakpoint
DROP TABLE `pokedex_entry_revision`;--> statement-breakpoint
ALTER TABLE `pokedex_entry` DROP COLUMN `text`;--> statement-breakpoint
ALTER TABLE `ability` ADD `description_en` text;--> statement-breakpoint
ALTER TABLE `ability` ADD `description_ja` text;--> statement-breakpoint
ALTER TABLE `ability` ADD `description_de` text;--> statement-breakpoint
ALTER TABLE `ability` ADD `description_fr` text;--> statement-breakpoint
ALTER TABLE `ability` ADD `description_it` text;--> statement-breakpoint
ALTER TABLE `ability` ADD `description_es` text;--> statement-breakpoint
ALTER TABLE `ability` ADD `description_ko` text;--> statement-breakpoint
ALTER TABLE `ability` ADD `description_zh_hans` text;--> statement-breakpoint
ALTER TABLE `ability` ADD `description_zh_hant` text;--> statement-breakpoint
ALTER TABLE `move` ADD `description_en` text;--> statement-breakpoint
ALTER TABLE `move` ADD `description_ja` text;--> statement-breakpoint
ALTER TABLE `move` ADD `description_de` text;--> statement-breakpoint
ALTER TABLE `move` ADD `description_fr` text;--> statement-breakpoint
ALTER TABLE `move` ADD `description_it` text;--> statement-breakpoint
ALTER TABLE `move` ADD `description_es` text;--> statement-breakpoint
ALTER TABLE `move` ADD `description_ko` text;--> statement-breakpoint
ALTER TABLE `move` ADD `description_zh_hans` text;--> statement-breakpoint
ALTER TABLE `move` ADD `description_zh_hant` text;--> statement-breakpoint
ALTER TABLE `pokedex_entry` ADD `text_en` text;--> statement-breakpoint
ALTER TABLE `pokedex_entry` ADD `text_ja` text;--> statement-breakpoint
ALTER TABLE `pokedex_entry` ADD `text_de` text;--> statement-breakpoint
ALTER TABLE `pokedex_entry` ADD `text_fr` text;--> statement-breakpoint
ALTER TABLE `pokedex_entry` ADD `text_it` text;--> statement-breakpoint
ALTER TABLE `pokedex_entry` ADD `text_es` text;--> statement-breakpoint
ALTER TABLE `pokedex_entry` ADD `text_ko` text;--> statement-breakpoint
ALTER TABLE `pokedex_entry` ADD `text_zh_hans` text;--> statement-breakpoint
ALTER TABLE `pokedex_entry` ADD `text_zh_hant` text;--> statement-breakpoint
CREATE VIRTUAL TABLE pokemon_fts USING fts5(
    slug, name_en, name_ja, name_de, name_fr,
    name_it, name_es, name_ko, name_zh_hans, name_zh_hant,
    content='pokemon',
    content_rowid='ndex',
    tokenize='trigram'
);--> statement-breakpoint
INSERT INTO pokemon_fts(pokemon_fts) VALUES('rebuild');
