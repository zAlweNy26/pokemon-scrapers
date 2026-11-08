import { describe, expect, test } from 'bun:test'
import { DROPPED_MOVE, unwrap } from '@/scraper/build'

describe('unwrap', () => {
    test('a line break is a space, except after a hyphen', () => {
        expect(unwrap('Powers up Fire-\ntype moves\nin a pinch.')).toBe('Powers up Fire-type moves in a pinch.')
    })

    test('drops soft hyphens, joining the word they split', () => {
        expect(unwrap('Pre­\nvents sleep.')).toBe('Prevents sleep.')
    })
})

describe('DROPPED_MOVE', () => {
    test("matches the dropped-move notice with either apostrophe, not a move that can't be used twice", () => {
        expect(DROPPED_MOVE.test("This move can't be used. It's recommended that this move is forgotten. Once forgotten, this move can't be remembered.")).toBe(true)
        expect(DROPPED_MOVE.test('This move can’t be used. It’s recommended that this move is forgotten.')).toBe(true)
        expect(DROPPED_MOVE.test("The user swings its hammer. This move can't be used twice in a row.")).toBe(false)
    })
})
