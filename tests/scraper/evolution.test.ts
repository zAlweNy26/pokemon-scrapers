import { describe, expect, test } from 'bun:test'
import { evolutionConditions, identifiers, type ConditionLookups } from '@/scraper/build'

// A PokéAPI `pokemon_evolution` row with nothing set: empty strings, flags '0'.
const blank = {
    minimum_level: '', trigger_item_id: '', held_item_id: '', known_move_id: '', known_move_type_id: '',
    used_move_id: '', minimum_move_count: '', gender_id: '', time_of_day: '', location_id: '', region_id: '',
    minimum_happiness: '', minimum_beauty: '', minimum_affection: '', relative_physical_stats: '',
    party_species_id: '', party_type_id: '', trade_species_id: '', minimum_steps: '', minimum_damage_taken: '',
    nature_bitmask: '', percentage_chance: '', condition_expression: '',
    needs_overworld_rain: '0', turn_upside_down: '0', needs_multiplayer: '0', near_special_rock: '0'
}

const lookups: ConditionLookups = {
    item: identifiers([{ id: '83', identifier: 'thunder-stone' }]),
    move: identifiers([]),
    type: identifiers([{ id: '17', identifier: 'dark' }]),
    gender: identifiers([{ id: '1', identifier: 'female' }, { id: '2', identifier: 'male' }]),
    location: identifiers([]),
    region: identifiers([{ id: '7', identifier: 'alola' }]),
    species: identifiers([{ id: '223', identifier: 'remoraid' }]),
    // natures.csv order, which the bitmask follows - not the in-game index.
    natures: ['hardy', 'bold', 'modest', 'calm', 'timid'].map((identifier, index) => ({ id: String(index + 1), identifier }))
}

describe('evolutionConditions', () => {
    test('leaves out every unset condition', () => {
        expect(evolutionConditions(blank, lookups)).toEqual({})
    })

    test('turns ids into identifiers and keeps numbers as numbers', () => {
        expect(evolutionConditions({ ...blank, trigger_item_id: '83', region_id: '7' }, lookups)).toEqual({
            item: 'thunder-stone',
            region: 'alola'
        })
        // Pancham: level 32 with a Dark type in the party.
        expect(evolutionConditions({ ...blank, minimum_level: '32', party_type_id: '17' }, lookups)).toEqual({
            minLevel: 32,
            partyType: 'dark'
        })
        expect(evolutionConditions({ ...blank, relative_physical_stats: '0', gender_id: '1' }, lookups)).toEqual({
            relativePhysicalStats: 0,
            gender: 'female'
        })
    })

    test('reports flags only when they hold', () => {
        expect(evolutionConditions({ ...blank, turn_upside_down: '1' }, lookups)).toEqual({ upsideDown: true })
    })

    test('decodes the nature bitmask by PokéAPI nature id', () => {
        // Bits 0 and 2: ids 1 and 3.
        expect(evolutionConditions({ ...blank, nature_bitmask: '5' }, lookups)).toEqual({ natures: ['hardy', 'modest'] })
    })
})
