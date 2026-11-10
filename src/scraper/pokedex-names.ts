import type { Texts } from './corpus'

/**
 * Regional Pokédex names, by PokéAPI pokedex identifier. Not game text: ours (CLAUDE.md,
 * "Game text only"), agreed with Dany on 2026-11-10, for a table in one style with every
 * language filled.
 *
 * - Where a game labels the Pokédex, its latest label, with only all-capitals, "DEX" and
 *   straight apostrophes evened out ("UNOVA POKÉDEX" → "Unova Pokédex"); an official label
 *   that is complete stays as it is ("Extra Dex", "パルデア地方図鑑", "ヨロイ島ずかん").
 * - Where none does, the region's name as HOME's Pokédex filter writes it in each language
 *   (カントー地方 → カントー), in the form the games give a Pokédex there: "<Area> Pokédex",
 *   "<Area>図鑑", "<Area>-Pokédex", "Pokédex de/di <Area>", "<Area>도감", "<Area>图鉴/圖鑑".
 *   Champions keeps its Latin title in every language, as the game writes it.
 * - The Chinese for the three Kalos Pokédexes translates Central/Coastal/Mountain (中央, 海岸,
 *   山岳): X/Y never shipped in Chinese.
 * - Pokédexes of the same region share a name, as in the games (Gold/Silver's and
 *   HeartGold/SoulSilver's Johto); their games tell them apart.
 */
const name = (
    en: string, ja: string, de: string, fr: string, it: string, es: string, ko: string, zhHans: string, zhHant: string
): Texts => ({ en, ja, de, fr, it, es, ko, zh_hans: zhHans, zh_hant: zhHant })

const KANTO = name('Kanto Pokédex', 'カントー図鑑', 'Kanto-Pokédex', 'Pokédex de Kanto', 'Pokédex di Kanto', 'Pokédex de Kanto', '관동도감', '关都图鉴', '關都圖鑑')
const JOHTO = name('Johto Pokédex', 'ジョウト図鑑', 'Johto-Pokédex', 'Pokédex de Johto', 'Pokédex di Johto', 'Pokédex de Johto', '성도도감', '城都图鉴', '城都圖鑑')
const HOENN = name('Hoenn Pokédex', 'ホウエンずかん', 'Hoenn-Pokédex', 'Pokédex de Hoenn', 'Pokédex di Hoenn', 'Pokédex de Hoenn', '호연도감', '丰缘图鉴', '豐緣圖鑑')
const SINNOH = name('Sinnoh Pokédex', 'シンオウ図鑑', 'Sinnoh-Pokédex', 'Pokédex de Sinnoh', 'Pokédex di Sinnoh', 'Pokédex de Sinnoh', '신오도감', '神奥图鉴', '神奧圖鑑')
const UNOVA = name('Unova Pokédex', 'イッシュ図鑑', 'Einall-Pokédex', 'Pokédex d’Unys', 'Pokédex di Unima', 'Pokédex de Teselia', '하나도감', '合众图鉴', '合眾圖鑑')
const ALOLA = name('Alola Pokédex', 'アローラ図鑑', 'Alola-Pokédex', 'Pokédex d’Alola', 'Pokédex di Alola', 'Pokédex de Alola', '알로라도감', '阿罗拉图鉴', '阿羅拉圖鑑')
const MELEMELE = name('Melemele Pokédex', 'メレメレ図鑑', 'Mele-Mele-Pokédex', 'Pokédex de Mele-Mele', 'Pokédex di Mele Mele', 'Pokédex de Melemele', '멜레멜레도감', '美乐美乐图鉴', '美樂美樂圖鑑')
const AKALA = name('Akala Pokédex', 'アーカラ図鑑', 'Akala-Pokédex', 'Pokédex d’Akala', 'Pokédex di Akala', 'Pokédex de Akala', '아칼라도감', '阿卡拉图鉴', '阿卡拉圖鑑')
const ULAULA = name('Ula’ula Pokédex', 'ウラウラ図鑑', 'Ula-Ula-Pokédex', 'Pokédex d’Ula-Ula', 'Pokédex di Ula Ula', 'Pokédex de Ula-Ula', '울라울라도감', '乌拉乌拉图鉴', '烏拉烏拉圖鑑')
const PONI = name('Poni Pokédex', 'ポニ図鑑', 'Poni-Pokédex', 'Pokédex de Poni', 'Pokédex di Poni', 'Pokédex de Poni', '포니도감', '波尼图鉴', '波尼圖鑑')

export const POKEDEX_NAMES: Record<string, Texts> = {
    kanto: KANTO,
    'letsgo-kanto': KANTO,
    'original-johto': JOHTO,
    'updated-johto': JOHTO,
    hoenn: HOENN,
    'updated-hoenn': HOENN,
    'original-sinnoh': SINNOH,
    'extended-sinnoh': SINNOH,
    'original-unova': UNOVA,
    'updated-unova': UNOVA,
    'kalos-central': name('Central Kalos Pokédex', 'セントラルカロス図鑑', 'Kalos-Zentral-Pokédex', 'Pokédex Kalos : Centre', 'Pokédex Kalos Centrale', 'Pokédex Kalos Centro', '센트럴칼로스도감', '中央卡洛斯图鉴', '中央卡洛斯圖鑑'),
    'kalos-coastal': name('Coastal Kalos Pokédex', 'コーストカロス図鑑', 'Kalos-Küsten-Pokédex', 'Pokédex Kalos : Côtes', 'Pokédex Kalos Costiera', 'Pokédex Kalos Costa', '코스트칼로스도감', '海岸卡洛斯图鉴', '海岸卡洛斯圖鑑'),
    'kalos-mountain': name('Mountain Kalos Pokédex', 'マウンテンカロス図鑑', 'Kalos-Gebirgs-Pokédex', 'Pokédex Kalos : Monts', 'Pokédex Kalos Montana', 'Pokédex Kalos Montaña', '마운틴칼로스도감', '山岳卡洛斯图鉴', '山岳卡洛斯圖鑑'),
    'original-alola': ALOLA,
    'updated-alola': ALOLA,
    'original-melemele': MELEMELE,
    'updated-melemele': MELEMELE,
    'original-akala': AKALA,
    'updated-akala': AKALA,
    'original-ulaula': ULAULA,
    'updated-ulaula': ULAULA,
    'original-poni': PONI,
    'updated-poni': PONI,
    galar: name('Galar Pokédex', 'ガラル図鑑', 'Galar-Pokédex', 'Pokédex de Galar', 'Pokédex di Galar', 'Pokédex de Galar', '가라르도감', '伽勒尔图鉴', '伽勒爾圖鑑'),
    'isle-of-armor': name('Isle of Armor Pokédex', 'ヨロイ島ずかん', 'Rüstungs-Pokédex', 'Pokédex d’Isolarmure', 'Pokédex Armatura', 'Pokédex Armadura', '갑옷섬도감', '铠岛图鉴', '鎧島圖鑑'),
    'crown-tundra': name('Crown Tundra Pokédex', 'カンムリ雪原ずかん', 'Kronen-Pokédex', 'Pokédex de Couronneige', 'Pokédex Corona', 'Pokédex Corona', '왕관설원도감', '王冠雪原图鉴', '王冠雪原圖鑑'),
    hisui: name('Hisui Pokédex', 'ヒスイ図鑑', 'Hisui-Pokédex', 'Pokédex de Hisui', 'Pokédex di Hisui', 'Pokédex de Hisui', '히스이도감', '洗翠图鉴', '洗翠圖鑑'),
    paldea: name('Paldea Pokédex', 'パルデア地方図鑑', 'Paldea-Pokédex', 'Pokédex de Paldea', 'Pokédex di Paldea', 'Pokédex de Paldea', '팔데아도감', '帕底亚地区图鉴', '帕底亞地區圖鑑'),
    kitakami: name('Kitakami Pokédex', 'キタカミ図鑑', 'Kitakami-Pokédex', 'Pokédex de Septentria', 'Pokédex di Nordivia', 'Pokédex de Noroteo', '북신도감', '北上图鉴', '北上圖鑑'),
    blueberry: name('Blueberry Pokédex', 'ブルーベリー図鑑', 'Blaubeer-Pokédex', 'Pokédex Myrtille', 'Pokédex Mirtillo', 'Pokédex Arándano', '블루베리도감', '蓝莓图鉴', '藍莓圖鑑'),
    'lumiose-city': name('Lumiose Pokédex', 'ミアレ図鑑', 'Illumina-Pokédex', 'Pokédex d’Illumis', 'Pokédex di Luminopoli', 'Pokédex de Luminalia', '미르도감', '密阿雷图鉴', '密阿雷圖鑑'),
    hyperspace: name('Hyperspace Pokédex', '異次元図鑑', 'Dimensions-Pokédex', 'Extra Dex', 'Pokédex dimensionale', 'Pokédex Dimensional', '이차원도감', '异次元图鉴', '異次元圖鑑'),
    champions: name('Champions Pokédex', 'Champions図鑑', 'Champions-Pokédex', 'Pokédex de Champions', 'Pokédex di Champions', 'Pokédex de Champions', 'Champions도감', 'Champions图鉴', 'Champions圖鑑')
}
