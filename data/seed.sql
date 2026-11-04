-- Development / test fixture. Small, but deliberately covers the awkward cases:
-- multi-form species, a form that cannot be deposited into HOME, names that differ
-- across languages, and two-character CJK names that fall below the FTS5 trigram floor.
-- Replaced wholesale by the scraper's output; never hand-edit generated data.

DELETE FROM encounter;
DELETE FROM form_ability;
DELETE FROM form_type;
DELETE FROM form;
DELETE FROM pokemon_origin;
DELETE FROM pokemon_egg_group;
DELETE FROM pokemon;
DELETE FROM generation;
DELETE FROM meta;

INSERT INTO generation (id, region, debut) VALUES
    (1, 'Kanto',  1996),
    (4, 'Sinnoh', 2006),
    (6, 'Kalos',  2013),
    (8, 'Galar',  2019),
    (9, 'Paldea', 2022);

INSERT INTO pokemon
    (ndex, slug, gen, category, catch_rate, base_friendship, gender_rate, egg_cycles,
     name_en, name_ja, name_ja_romaji, name_de, name_fr, name_it, name_es, name_ko, name_zh_hans, name_zh_hant)
VALUES
    (25,   'pikachu',  1, 'Mouse',      190, 50,  4, 10,
     'Pikachu','ピカチュウ','Pikachu','Pikachu','Pikachu','Pikachu','Pikachu','피카츄','皮卡丘','皮卡丘'),
    (26,   'raichu',   1, 'Mouse',      75, 50,  4, 10,
     'Raichu','ライチュウ','Raichu','Raichu','Raichu','Raichu','Raichu','라이츄','雷丘','雷丘'),
    (94,   'gengar',   1, 'Shadow',      45, 50,  4, 20,
     'Gengar','ゲンガー','Gengar','Gengar','Ectoplasma','Gengar','Gengar','팬텀','耿鬼','耿鬼'),
    (131,  'lapras',   1, 'Transport',   45, 50,  4, 40,
     'Lapras','ラプラス','Laplace','Lapras','Lokhlass','Lapras','Lapras','라프라스','拉普拉斯','拉普拉斯'),
    (479,  'rotom',    4, 'Plasma',      45, 50, -1, 20,
     'Rotom','ロトム','Rotom','Rotom','Motisma','Rotom','Rotom','로토무','洛托姆','洛托姆'),
    (658,  'greninja', 6, 'Ninja',       45, 50,  1, 20,
     'Greninja','ゲッコウガ','Gekkouga','Quajutsu','Amphinobi','Greninja','Greninja','개굴닌자','甲贺忍蛙','甲賀忍蛙'),
    (892,  'urshifu',  8, 'Wushu',        3, 50,  1, 40,
     'Urshifu','ウーラオス','Wulaosu','Wulaosu','Shifours','Urshifu','Urshifu','우라오스','武道熊师','武道熊師'),
    (1017, 'ogerpon',  9, 'Mask',         5, 50,  8, 20,
     'Ogerpon','オーガポン','Ogapon','Oger-Pon','Ogerpon','Ogerpon','Ogerpon','오거폰','厄诡椪','厄詭椪');

INSERT INTO pokemon_egg_group (ndex, egg_group) VALUES
    (25,'Field'),(25,'Fairy'),
    (26,'Field'),(26,'Fairy'),
    (94,'Amorphous'),
    (131,'Monster'),(131,'Water 1'),
    (479,'Amorphous'),
    (658,'Water 1'),
    (892,'Field'),(892,'Human-Like'),
    (1017,'Grass'),(1017,'Human-Like');

INSERT INTO pokemon_origin (ndex, lang, note) VALUES
    (25,'en','From "pika", the Japanese onomatopoeia for an electric spark, and "chu", the sound a mouse makes.'),
    (25,'ja','ピカ (pika, sparkle) + チュウ (chu, squeak).'),
    (658,'de','Quajutsu blends "quaken" (to croak) with "Jutsu", the ninja arts.'),
    (658,'fr','Amphinobi combines "amphibien" with "shinobi".'),
    (892,'en','From "urushi" (lacquer) and "shifu", a martial-arts master.');

INSERT INTO form
    (id, ndex, slug, name_en, is_default, depositable, height_m, weight_kg, hp, atk, def, sp_atk, sp_def, spd, sprite_key)
VALUES
    (1,  25,  'pikachu',                 'Pikachu',           1, 1, 0.4,  6.0,  35, 55, 40, 50, 50,  90, 'pokemon/25/pikachu'),
    (2,  25,  'pikachu-partner',         'Partner Pikachu',   0, 0, 0.4,  6.0,  45, 80, 50, 75, 60, 120, 'pokemon/25/pikachu-partner'),
    (13, 26,  'raichu',                  'Raichu',            1, 1, 0.8, 30.0,  60, 90, 55, 90, 80, 110, 'pokemon/26/raichu'),
    (3,  94,  'gengar',                  'Gengar',            1, 1, 1.5, 40.5,  60, 65, 60, 130, 75, 110, 'pokemon/94/gengar'),
    (4,  131, 'lapras',                  'Lapras',            1, 1, 2.5, 220.0, 130, 85, 80, 85, 95,  60, 'pokemon/131/lapras'),
    (5,  479, 'rotom',                   'Rotom',             1, 1, 0.3,  0.3,  50, 50, 77, 95, 77,  91, 'pokemon/479/rotom'),
    (6,  479, 'rotom-wash',              'Wash Rotom',        0, 1, 0.3,  0.3,  50, 65, 107, 105, 107, 86, 'pokemon/479/rotom-wash'),
    (7,  658, 'greninja',                'Greninja',          1, 1, 1.5, 40.0,  72, 95, 67, 103, 71, 122, 'pokemon/658/greninja'),
    (8,  658, 'greninja-ash',            'Ash-Greninja',      0, 0, 1.5, 40.0,  72, 145, 67, 153, 71, 132, NULL),
    (9,  892, 'urshifu-single-strike',   'Single Strike Style', 1, 1, 1.9, 105.0, 100, 130, 100, 63, 60, 97, 'pokemon/892/urshifu-single-strike'),
    (10, 892, 'urshifu-rapid-strike',    'Rapid Strike Style',  0, 1, 1.9, 105.0, 100, 130, 100, 63, 60, 97, 'pokemon/892/urshifu-rapid-strike'),
    (11, 1017,'ogerpon-teal',            'Teal Mask',         1, 1, 1.2, 39.8,  80, 120, 84, 60, 96, 110, 'pokemon/1017/ogerpon-teal'),
    (12, 1017,'ogerpon-hearthflame',     'Hearthflame Mask',  0, 1, 1.2, 39.8,  80, 120, 84, 60, 96, 110, 'pokemon/1017/ogerpon-hearthflame');

INSERT INTO form_type (form_id, slot, type) VALUES
    (1,1,'Electric'),(2,1,'Electric'),(13,1,'Electric'),
    (3,1,'Ghost'),(3,2,'Poison'),
    (4,1,'Water'),(4,2,'Ice'),
    (5,1,'Electric'),(5,2,'Ghost'),
    (6,1,'Electric'),(6,2,'Water'),
    (7,1,'Water'),(7,2,'Dark'),
    (8,1,'Water'),(8,2,'Dark'),
    (9,1,'Fighting'),(9,2,'Dark'),
    (10,1,'Fighting'),(10,2,'Water'),
    (11,1,'Grass'),
    (12,1,'Grass'),(12,2,'Fire');

INSERT INTO form_ability (form_id, slot, ability, is_hidden) VALUES
    (1,1,'Static',0),(1,2,'Lightning Rod',1),
    (13,1,'Static',0),(13,2,'Lightning Rod',1),
    (3,1,'Cursed Body',0),
    (4,1,'Water Absorb',0),(4,2,'Shell Armor',0),(4,3,'Hydration',1),
    (5,1,'Levitate',0),
    (6,1,'Levitate',0),
    (7,1,'Torrent',0),(7,2,'Protean',1),
    (8,1,'Battle Bond',0),
    (9,1,'Unseen Fist',0),
    (10,1,'Unseen Fist',0),
    (11,1,'Defiant',0),
    (12,1,'Mold Breaker',0);

INSERT INTO encounter (ndex, game, location, method) VALUES
    (25,'Red','Viridian Forest','Walking'),
    (25,'Scarlet','South Province (Area Three)','Walking'),
    (26,'Red','Power Plant','Walking'),
    (94,'Red','Trade only','Evolution'),
    (131,'Red','Silph Co. 7F','Gift'),
    (658,'X','Starter choice','Evolution'),
    (892,'Sword','Tower of Darkness','Gift'),
    (1017,'Scarlet','Kitakami - Oni Mountain','Static');

INSERT INTO meta (key, value) VALUES
    ('generated_at','2026-08-24T00:00:00Z'),
    ('source_veekun','seed'),
    ('source_pokeapi','seed'),
    ('source_bulbapedia','seed'),
    ('source_serebii','seed');

-- Counts are stored at load time so /v1/meta never scans a table per request.
-- Computed here, from the rows just loaded, so they cannot drift from the data.
INSERT INTO meta (key, value)
    SELECT 'count_pokemon', count(*) FROM pokemon
    UNION ALL SELECT 'count_forms', count(*) FROM form
    UNION ALL SELECT 'count_encounters', count(*) FROM encounter;

-- Rebuilt from `pokemon` rather than deleted and re-inserted: `DELETE FROM pokemon_fts`
-- reads the *current* rows to find the words to remove, so after any change to
-- `pokemon` it removes the wrong ones and corrupts the index.
INSERT INTO pokemon_fts(pokemon_fts) VALUES('rebuild');
