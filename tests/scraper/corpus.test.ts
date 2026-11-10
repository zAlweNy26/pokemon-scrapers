import { describe, expect, test } from 'bun:test'
import { render } from '@/scraper/corpus'

describe('render', () => {
    test('joins the text box lines with a space where the language spaces its words', () => {
        expect(render('The user attacks with a strong electric blast.\\nThis may also paralyze.', 'en')).toBe(
            'The user attacks with a strong electric blast. This may also paralyze.'
        )
        expect(render('강한 전격을\\n상대에게 날려서 공격한다.', 'ko')).toBe('강한 전격을 상대에게 날려서 공격한다.')
    })

    test('keeps a word the box split after its hyphen whole', () => {
        expect(render('Powers up Fire-\\ntype moves.', 'en')).toBe('Powers up Fire-type moves.')
        expect(render('feed on envy and malice--\\nor so it’s said', 'en')).toBe('feed on envy and malice--or so it’s said')
    })

    test('keeps the space after a hyphen that stands for a word left out', () => {
        expect(render('with Normal-\\nand Fighting-type moves', 'en')).toBe('with Normal- and Fighting-type moves')
        expect(render('an den Vorder-\\nund Hinterbeinen', 'de')).toBe('an den Vorder- und Hinterbeinen')
    })

    test('joins Japanese kana lines with the full-width space it puts between phrases, and Chinese with nothing', () => {
        expect(render('強い　電撃を\\n相手に　浴びせて　攻撃する。', 'ja')).toBe('強い　電撃を　相手に　浴びせて　攻撃する。')
        expect(render('向對手放出強力電流進行攻擊。\\n有時會讓對手陷入麻痺狀態。', 'zh_hant')).toBe(
            '向對手放出強力電流進行攻擊。有時會讓對手陷入麻痺狀態。'
        )
    })

    test("treats Generation III-IV's page and scroll codes as breaks", () => {
        expect(render('It carries a seed\\non its back\\pright from birth.', 'en')).toBe('It carries a seed on its back right from birth.')
    })

    test('gives null for a placeholder the game fills at run time, or no text', () => {
        expect(render('[~ 237]', 'en')).toBeNull()
        expect(render('[VAR 0101(0000)] is ready.', 'en')).toBeNull()
        expect(render(null, 'en')).toBeNull()
        expect(render('', 'en')).toBeNull()
    })
})
