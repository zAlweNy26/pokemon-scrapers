import type { FormInfo } from './build'

export const ZA_ALPHA_PAGE = 'List of alpha Pokémon in Legends: Z-A by exclusive move'

/**
 * Every row of the page's table, `${ndex}${form}` → whether it appears as a wild
 * alpha: `form` is the sprite's form parameter (`-Galar`, `-Female`), '' for the
 * species. A starred move means the game lists one it never uses (Mewtwo): false.
 * A second row with the same sprite is the form its label names (Greninja, then
 * `<small>Battle Bond</small>` Greninja → `658-Battle-Bond`), so it cannot overwrite the first.
 */
export const zaAlphaRowsOf = (wikitext: string): Map<string, boolean> => {
    const rows = [...wikitext.matchAll(/(?:<small>([^<]*)<\/small>\s*\|\|\s*)?\{\{MSP\/ZA\|(\d{4})\|[^|}]*(?:\|form=([^|}]*))?\}\}\s*\n\|[^\n]*?\}\}(\*?)/g)]
    if (rows.length < 300) throw new Error(`${ZA_ALPHA_PAGE}: only ${rows.length} rows - layout changed?`)
    const result = new Map<string, boolean>()
    for (const [, label, ndex, form, star] of rows) {
        const key = `${Number(ndex)}${form ?? ''}`
        if (!result.has(key)) result.set(key, !star)
        else if (label) result.set(`${key}-${label.replaceAll(' ', '-')}`, !star)
        else throw new Error(`${ZA_ALPHA_PAGE}: two rows for ${key} and no label to tell them apart`)
    }
    return result
}

/**
 * Ids of the forms that can be wild alphas, from `zaAlphaRowsOf`. A row with a form
 * parameter is the form whose slug has it (`-Galar` → meowth-galar, `-Battle-Bond` →
 * greninja-battle-bond); a species row
 * is its default form and its other forms in `inGame` that no row names. Throws on
 * a form parameter that matches no form.
 */
export const alphaFormsOf = (rows: Map<string, boolean>, forms: FormInfo[], inGame: Set<number>): Set<number> => {
    const ids = new Set<number>()
    const named = new Set<number>()

    for (const [key, alpha] of rows) {
        const [, ndex, parameter] = /^(\d+)(.*)$/.exec(key)!
        if (!parameter) continue
        const part = `-${parameter.slice(1).toLowerCase()}-`
        const form = forms.find((form) => form.ndex === Number(ndex) && `-${form.slug}-`.includes(part))
        if (!form) throw new Error(`${ZA_ALPHA_PAGE}: no form for ${key}`)
        named.add(form.id)
        if (alpha) ids.add(form.id)
    }

    for (const form of forms)
        if (!named.has(form.id) && rows.get(`${form.ndex}`) && (form.isDefault || inGame.has(form.id))) ids.add(form.id)

    return ids
}

/**
 * Legends: Arceus by Bulbapedia's rule ("Alpha Pokémon"): every Pokémon in the game
 * can be an alpha but Legendary and Mythical ones and the gift-only Alolan Vulpix
 * and Ninetales. `inGame` is the forms the game can hold.
 */
export const legendsArceusAlphas = (forms: FormInfo[], inGame: Set<number>, legendary: Set<number>): Set<number> =>
    new Set(
        forms
            .filter((form) => inGame.has(form.id) && !legendary.has(form.ndex))
            .filter((form) => form.slug !== 'vulpix-alola' && form.slug !== 'ninetales-alola')
            .map((form) => form.id)
    )
