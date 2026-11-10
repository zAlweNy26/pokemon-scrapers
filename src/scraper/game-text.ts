import { readCorpus, render, renderTexts, type CorpusFile, type CorpusGame, type Texts } from './corpus'

/**
 * Names and categories as the games show them, from Poké Corpus (CLAUDE.md, "Game text only").
 * HOME is the newest game to list every species, form, ability and move; Champions adds what
 * came after it, and Scarlet/Violet the Stellar type HOME does not list.
 */
export interface GameText {
    species(ndex: number): Texts | undefined
    category(ndex: number): Texts | undefined
    /** A form's label ("Alolan Form"), found by its species and PokéAPI's English label for it. */
    formLabel(ndex: number, english: string): Texts | undefined
    /**
     * HOME's English label for a species' form by its index in the games ("Alolan Form" for Raichu's 1),
     * with the second line HOME shows under it where there is one ("Paldean Form Combat Breed").
     */
    formLabelAt(ndex: number, index: number): string | undefined
    ability(english: string): Texts | undefined
    move(english: string): Texts | undefined
    type(english: string): Texts | undefined
    /** The in-game description, rendered, from the latest game that has a real one. */
    abilityDescription(english: string): Texts | undefined
    moveDescription(english: string): Texts | undefined
    /** The label the game gives a regional Pokédex, by PokéAPI identifier; undefined where no game names it. */
    pokedex(slug: string): Texts | undefined
}

/**
 * Where a game names each regional Pokédex, by PokéAPI identifier. Picked by hand and read in
 * every language: some labels saying "Central Kalos Pokédex" in English are a rating prompt in
 * Japanese, so a label is only listed once its other languages name the Pokédex too. Kanto,
 * both Johtos, Platinum's Sinnoh, Let's Go Kanto, Hisui and Champions are never named on their own.
 */
const POKEDEX_LABELS: Record<string, [CorpusGame, string, string]> = {
    hoenn: ['RubySapphire', 'msg', 'rs.common.strings.DexText_HoennDex'],
    'original-sinnoh': ['BrilliantDiamondShiningPearl', 'message', 'bdsp.ss_pokedex.SS_pokedex_183'],
    'original-unova': ['BlackWhite', 'common', 'bw.common.276.0'],
    'updated-unova': ['Black2White2', 'common', 'b2w2.common.478.0'],
    'kalos-central': ['XY', 'common', 'xy.common.3.81'],
    'kalos-coastal': ['XY', 'common', 'xy.common.3.82'],
    'kalos-mountain': ['XY', 'common', 'xy.common.3.83'],
    'updated-hoenn': ['OmegaRubyAlphaSapphire', 'common', 'oras.common.3.90'],
    'original-alola': ['SunMoon', 'common', 'sm.common.118.4'],
    'original-melemele': ['SunMoon', 'common', 'sm.common.118.5'],
    'original-akala': ['SunMoon', 'common', 'sm.common.118.6'],
    'original-ulaula': ['SunMoon', 'common', 'sm.common.118.7'],
    'original-poni': ['SunMoon', 'common', 'sm.common.118.8'],
    'updated-alola': ['UltraSunUltraMoon', 'common', 'usum.common.123.4'],
    'updated-melemele': ['UltraSunUltraMoon', 'common', 'usum.common.123.5'],
    'updated-akala': ['UltraSunUltraMoon', 'common', 'usum.common.123.6'],
    'updated-ulaula': ['UltraSunUltraMoon', 'common', 'usum.common.123.7'],
    'updated-poni': ['UltraSunUltraMoon', 'common', 'usum.common.123.8'],
    // Sword/Shield calls its Galar Pokédex just "Pokédex".
    galar: ['SwordShield', 'common', 'swsh.pokedex.msg_ui_pokedex_place_00'],
    'isle-of-armor': ['SwordShield', 'common', 'swsh.pokedex.msg_ui_pokedex_place_01'],
    'crown-tundra': ['SwordShield', 'common', 'swsh.pokedex.msg_ui_pokedex_place_02'],
    paldea: ['ScarletViolet', 'common', 'sv.leaguecard.leaguecard_02_02'],
    kitakami: ['ScarletViolet', 'common', 'sv.pokedex.pokedex_16_00'],
    blueberry: ['ScarletViolet', 'common', 'sv.pokedex.pokedex_19_00'],
    'lumiose-city': ['LegendsZA', 'common', 'za.pokedex.pokedex_30_01'],
    hyperspace: ['LegendsZA', 'common', 'za.pokedex.pokedex_30_02']
}

/** What Sword/Shield onwards say for a move they dropped: not a description, so an older game's text is used. */
export const DROPPED_MOVE = /^This move can.t be used\. It.s recommended that this move is forgotten\./

/** Labels match across sources despite typography: PokéAPI writes ' where the games write ’. */
export const englishKey = (text: string) => text.replace(/[’‘]/g, "'").replace(/\s+/g, ' ').trim().toLowerCase()

/**
 * PokéAPI's English label for a form → HOME's, where the two name the same form in different
 * games' words (X/Y's "Average Size" is HOME's "Medium Variety").
 */
const FORM_LABEL_SYNONYMS: Record<string, string> = {
    'gigantamax form': 'gigantamax',
    'average size': 'medium variety',
    'small size': 'small variety',
    'large size': 'large variety',
    'super size': 'jumbo variety'
}

/** Every message under `section` (`home.nx.monsname.`), keyed by what `keyOf` makes of the label's tail. */
const section = <K>(file: CorpusFile, prefix: string, keyOf: (tail: string, texts: Texts) => K | undefined) => {
    const result = new Map<K, Texts>()
    for (const label of file.labels) {
        if (!label.startsWith(prefix)) continue
        const texts = file.get(label)!
        const key = keyOf(label.slice(prefix.length), texts)
        // The first source keeps a key: callers list the sources best first.
        if (key !== undefined && !result.has(key)) result.set(key, texts)
    }
    return result
}

const byNumber = (pattern: RegExp) => (tail: string) => {
    const match = tail.match(pattern)
    return match ? Number(match[1]) : undefined
}

const byEnglish = (_tail: string, texts: Texts) => (texts.en ? englishKey(texts.en) : undefined)

/** Merged maps of several sources, the first source winning a key. */
const merge = <K>(...maps: Map<K, Texts>[]) => {
    const result = new Map<K, Texts>()
    for (const map of maps) for (const [key, texts] of map) if (!result.has(key)) result.set(key, texts)
    return result
}

export const loadGameText = async (): Promise<GameText> => {
    const [home, champions, sv] = await Promise.all([
        readCorpus('HOME', 'megaturtle_nx'),
        readCorpus('Champions', 'ms'),
        readCorpus('ScarletViolet', 'common')
    ])

    const species = section(home, 'home.nx.monsname.MONSNAME_', byNumber(/^(\d+)$/))
    const categories = section(home, 'home.nx.zkn_type.ZKN_TYPE_', byNumber(/^(\d+)$/))
    const abilities = merge(section(home, 'home.nx.tokusei.', byEnglish), section(champions, 'cmp.tokusei.', byEnglish))
    const moves = merge(section(home, 'home.nx.wazaname.', byEnglish), section(champions, 'cmp.wazaname.', byEnglish))
    const types = section(sv, 'sv.typename.', byEnglish)

    // `${ndex}|${english label}`; ZKN_FORM_978_005_1 and ZKN_FORM_double_form are not form labels.
    const formKey = (tail: string, texts: Texts) => {
        const match = tail.match(/^ZKN_FORM_(\d+)_(\d+)$/)
        return match && texts.en ? `${Number(match[1])}|${englishKey(texts.en)}` : undefined
    }
    const forms = merge(section(home, 'home.nx.zkn_form.', formKey), section(champions, 'cmp.zkn_form_syn.', formKey))
    const formsByIndex = section(home, 'home.nx.zkn_form.', (tail) => {
        const match = tail.match(/^ZKN_FORM_(\d+)_(\d+)(_1)?$/)
        return match ? `${Number(match[1])}|${Number(match[2])}${match[3] ?? ''}` : undefined
    })
    const formLabelAt = (ndex: number, index: number) => {
        const label = formsByIndex.get(`${ndex}|${index}`)?.en
        const second = formsByIndex.get(`${ndex}|${index}_1`)?.en
        return label ? (render(second ? `${label}\\n${second}` : label, 'en') ?? undefined) : undefined
    }

    /**
     * Descriptions keyed by English name: each description section numbers its texts like the
     * name section it belongs to (`TOKUSEIINFO_SV_009` describes `TOKUSEI_009`). Sections are
     * listed best first; a dropped move's notice or a placeholder is passed over.
     */
    const described = (names: Map<number, Texts>, sources: [CorpusFile, string][]) => {
        const result = new Map<string, Texts>()
        for (const [file, prefix] of sources)
            for (const [index, texts] of section(file, prefix, byNumber(/_(\d+)$/))) {
                const english = names.get(index)?.en
                const rendered = renderTexts(texts)
                if (!english || !rendered.en || DROPPED_MOVE.test(rendered.en)) continue
                if (!result.has(englishKey(english))) result.set(englishKey(english), rendered)
            }
        return result
    }
    const abilityNames = section(home, 'home.nx.tokusei.TOKUSEI_', byNumber(/^(\d+)$/))
    const championsAbilityNames = section(champions, 'cmp.tokusei.TOKUSEI_', byNumber(/^(\d+)$/))
    const moveNames = section(home, 'home.nx.wazaname.WAZANAME_', byNumber(/^(\d+)$/))
    const championsMoveNames = section(champions, 'cmp.wazaname.WAZANAME_', byNumber(/^(\d+)$/))
    // Scarlet/Violet is the latest main-series game with ability descriptions; Champions'
    // texts (a battle spin-off's mechanics, "Has a 30% chance...") only for abilities it alone has.
    const abilityDescriptions = merge(
        described(abilityNames, [
            [home, 'home.nx.tokuseiinfo_SV.'],
            [home, 'home.nx.tokuseiinfo_LA.'],
            [home, 'home.nx.tokuseiinfo_BDSP.'],
            [home, 'home.nx.tokuseiinfo_SWSH.'],
            [home, 'home.nx.tokuseiinfo_LPLE.'],
            [home, 'home.nx.tokuseiinfo_Champions.']
        ]),
        described(championsAbilityNames, [[champions, 'cmp.tokuseiinfo_syn.']])
    )
    // HOME's own list keeps a dropped move's last real description; the games' lists say it can't be used.
    const moveDescriptions = merge(
        described(moveNames, [
            [home, 'home.nx.wazainfo_all.'],
            [home, 'home.nx.wazainfo_SV.'],
            [home, 'home.nx.wazainfo_ZA.'],
            [home, 'home.nx.wazainfo_LA.'],
            [home, 'home.nx.wazainfo_BDSP.'],
            [home, 'home.nx.wazainfo_SWSH.'],
            [home, 'home.nx.wazainfo_LPLE.']
        ]),
        described(championsMoveNames, [[champions, 'cmp.wazainfo_syn.']])
    )

    const pokedexes = new Map<string, Texts>()
    const files = new Map<string, Promise<CorpusFile>>([['ScarletViolet/common', Promise.resolve(sv)]])
    for (const [slug, [game, file, label]] of Object.entries(POKEDEX_LABELS)) {
        const key = `${game}/${file}`
        if (!files.has(key)) files.set(key, readCorpus(game, file))
        const texts = (await files.get(key)!).get(label)
        if (!texts?.en) throw new Error(`Poké Corpus has no ${label} for the ${slug} Pokédex`)
        pokedexes.set(slug, texts)
    }

    return {
        species: (ndex) => species.get(ndex),
        category: (ndex) => categories.get(ndex),
        formLabel: (ndex, english) => {
            const key = englishKey(english)
            return forms.get(`${ndex}|${FORM_LABEL_SYNONYMS[key] ?? key}`)
        },
        formLabelAt,
        ability: (english) => abilities.get(englishKey(english)),
        move: (english) => moves.get(englishKey(english)),
        type: (english) => types.get(englishKey(english)),
        abilityDescription: (english) => abilityDescriptions.get(englishKey(english)),
        moveDescription: (english) => moveDescriptions.get(englishKey(english)),
        pokedex: (slug) => pokedexes.get(slug)
    }
}
