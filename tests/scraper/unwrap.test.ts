import { describe, expect, test } from 'bun:test'
import { unwrap } from '@/scraper/build'

describe('unwrap', () => {
    test('a line break is a space, except after a hyphen', () => {
        expect(unwrap('Powers up Fire-\ntype moves\nin a pinch.')).toBe('Powers up Fire-type moves in a pinch.')
    })

    test('drops soft hyphens, joining the word they split', () => {
        expect(unwrap('Pre­\nvents sleep.')).toBe('Prevents sleep.')
    })
})
