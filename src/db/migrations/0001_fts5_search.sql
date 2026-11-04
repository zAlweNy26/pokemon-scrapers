-- Hand-written, not generated.
--
-- Drizzle's schema DSL cannot express FTS5 virtual tables, so this file is
-- written by hand. Void rejects migrations missing from meta/_journal.json, so it
-- has a journal entry and the latest snapshot carries its prefix (0001_snapshot.json).
--
-- The trigram tokenizer supports substring matching in any script, but cannot
-- index queries shorter than 3 characters - two-character CJK queries are served
-- by a LIKE prefix fallback in the search service instead.
--
-- This is an external-content index over `pokemon`: it is NOT kept in sync by
-- triggers. A load ends with `INSERT INTO pokemon_fts(pokemon_fts) VALUES('rebuild')`,
-- which is the only time `pokemon` changes.
CREATE VIRTUAL TABLE pokemon_fts USING fts5(
    slug, name_en, name_ja, name_ja_romaji, name_de, name_fr,
    name_it, name_es, name_ko, name_zh_hans, name_zh_hant,
    content='pokemon',
    content_rowid='ndex',
    tokenize='trigram'
);
