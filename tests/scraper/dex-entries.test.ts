import { describe, expect, test } from 'bun:test'
import { render } from '@/scraper/corpus'
import { gameBoyText, unsplitWords } from '@/scraper/dex-entries'

const english = new Map([['#', 'POKé'], ['<PKMN>', '<PK><MN>']])

describe('gameBoyText', () => {
    test('prints literals, turns box codes into breaks and <DEXEND> into its full stop', () => {
        const raw = '{text_start}A strange seed was<NEXT>planted on its<NEXT>back at birth.<PAGE>The plant sprouts<NEXT>and grows with<NEXT>this #MON<DEXEND>@'
        expect(render(gameBoyText(raw, 'en', english), 'en')).toBe(
            'A strange seed was planted on its back at birth. The plant sprouts and grows with this POKéMON.'
        )
    })

    test("prints Japanese particles with the full-width space the game's literal carries", () => {
        const raw = 'せなか<NO>たね<NO>なかには<NEXT>えいよう<GA>たっぷり<DEXEND>'
        const japanese = new Map([['<NO>', 'の　'], ['<GA>', 'が　']])
        expect(render(gameBoyText(raw, 'ja', japanese), 'ja')).toBe('せなかの　たねの　なかには　えいようが　たっぷり。')
    })

    test('reads two-tile glyphs as letters', () => {
        expect(render(gameBoyText('A <PKMN> trainer@', 'es', english), 'es')).toBe('A PKMN trainer')
    })
})

describe('unsplitWords', () => {
    const vocabulary = (words: Record<string, number>) => [new Map(Object.entries(words))]
    const flatten = (text: string, words: Record<string, number>) => render(unsplitWords(text, vocabulary(words)), 'en')

    test('rejoins a word the box split, or one the games never spell out elsewhere', () => {
        expect(flatten('adds to its sun-\\nlight', { sunlight: 3 })).toBe('adds to its sunlight')
        expect(flatten('so resilient, prod-\\nding fingers', {})).toBe('so resilient, prodding fingers')
    })

    test('keeps a compound the games write hyphenated, or one made of two words', () => {
        expect(flatten('a whitish-\\nblue color', { 'whitish-blue': 2, whitishblue: 0 })).toBe('a whitish-blue color')
        expect(flatten('loves iceberg-\\nfilled oceans', { iceberg: 1, filled: 4 })).toBe('loves iceberg-filled oceans')
    })

    test('asks the Game Boy games first, where spelling differed from later games', () => {
        const words = [new Map([['hot-headed', 1]]), new Map([['hotheaded', 9]])]
        expect(render(unsplitWords('very hot-\\nheaded by nature', words), 'en')).toBe('very hot-headed by nature')
    })
})
