import { describe, expect, test } from 'bun:test'
import { plain, section, templateParams } from '@/scraper/wikitext'

// Shaped like Bulbapedia's Pikachu page.
const PAGE = `===Origin===
Pikachu was originally a {{wp|daifuku}}-like creature.

====Name origin====
Pikachu is a combination of ピカピカ ''pikapika'' ({{wp|onomatopoeia}} for sparkle) and チューチュー ''chūchū''.<ref name=Pokemon.com /><ref>[http://example.com The Ultimate Game Freak]</ref>

==In other languages==
{{Other languages|type=Electric
|ja=ピカチュウ ''Pikachu''|jameaning=From ピカピカ ''pikapika'' and {{tt|チューチュー|chūchū}}
|zh_yue=皮卡丘{{tt|*|Games}}<br>比卡超|zh_yuemeaning=From its Mandarin name<br>Same as English/Japanese name
|id=Pikachu ({{pkmn|Pocket Monsters}} only)|idmeaning=Same as [[English language|English]] name
}}
==See also==`

describe('section', () => {
    test('takes a section up to the next heading of any level', () => {
        expect(section(PAGE, 'Name origin')).toStartWith('Pikachu is a combination')
        expect(section(PAGE, 'Name origin')).not.toContain('In other languages')
        expect(section(PAGE, 'Missing')).toBeNull()
    })
})

describe('templateParams', () => {
    test('splits on pipes only at the template level', () => {
        // {{tt|...|...}}, [[a|b]] and {{pkmn|...}} inside values carry pipes of their own.
        const params = templateParams(PAGE, 'Other languages')!

        expect(params.type).toBe('Electric')
        expect(params.jameaning).toBe("From ピカピカ ''pikapika'' and {{tt|チューチュー|chūchū}}")
        expect(params.idmeaning).toBe('Same as [[English language|English]] name')
        expect(Object.keys(params)).toEqual(['type', 'ja', 'jameaning', 'zh_yue', 'zh_yuemeaning', 'id', 'idmeaning'])
    })

    test('returns null when the template is absent', () => {
        expect(templateParams('no template here', 'Other languages')).toBeNull()
    })
})

describe('plain', () => {
    test('renders what a reader sees: no refs, markup or footnote markers', () => {
        expect(plain(section(PAGE, 'Name origin')!)).toBe(
            'Pikachu is a combination of ピカピカ pikapika (onomatopoeia for sparkle) and チューチュー chūchū.'
        )
        expect(plain('皮卡丘{{tt|*|Games}}<br>比卡超')).toBe('皮卡丘; 比卡超')
        expect(plain('({{pkmn|Pocket Monsters}} only) {{p|Raichu}} [[Thunder Stone|stone]]')).toBe(
            '(Pocket Monsters only) Raichu stone'
        )
        // Link templates show their display text, not the page they link to (Template:Pkmn, Pkmn2, OBP).
        expect(plain('its {{pkmn|Trainer}}, {{pkmn2|wild}} ones, this {{OBP|Pokémon|species}}')).toBe(
            'its Trainer, wild ones, this Pokémon'
        )
    })

    test('renders game and badge templates as the wiki shows them', () => {
        // Their trailing arguments are suffixes, not text: "last argument" would print "s".
        expect(plain('{{game|Black and White|s|Black}}, {{game|Red and Blue|s}}, {{g|Black 2 and White 2|s}}')).toBe(
            'Black, Pokémon Red and Blue, Pokémon Black 2 and White 2'
        )
        expect(plain('{{game3|Black and White|Black 2, White 2|s 2}} and the {{Badge|Marsh}}')).toBe(
            'Black 2, White 2 and the Marsh Badge'
        )
    })

    test('renders nested templates from the inside out', () => {
        expect(plain('{{tt|{{wp|Kitsune|fox spirit}}|note}}')).toBe('fox spirit')
    })

    test('reports templates it can only guess at', () => {
        const unknown = new Set<string>()
        expect(plain('a {{mystery|word}} b {{specify}}', unknown)).toBe('a word b')
        expect([...unknown]).toEqual(['mystery'])
    })
})
