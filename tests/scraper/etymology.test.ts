import { expect, test } from 'bun:test'
import { originsOf } from '@/scraper/etymology'

const PAGE = `====Name origin====
Greninja may be a combination of ''grenouille'' (French for "frog") and {{wp|ninja}}.<ref>source</ref>

==In other languages==
{{Other languages|type=Water|type2=Dark
|ja=ゲッコウガ ''Gekkouga''|jameaning=From げこっ ''geko'' (croak) and 月光 ''gekkō''
|de=Quajutsu|demeaning=From ''Quak'' (croak) and ''Ninjutsu''
|fr=Amphinobi|frmeaning=
|zh_cmn=甲賀忍蛙 ''Jiǎhèrěnwā''|zh_cmnmeaning=From 甲賀 ''Jiǎhè'' (Kōga) and 忍蛙 ''rěnwā''
|zh_yue=甲賀忍蛙|zh_yuemeaning=Cantonese is not one of our languages
}}`

test('reads English from "Name origin" and the rest from the language table', () => {
    const notes = Object.fromEntries(originsOf(PAGE, new Set()))

    expect(notes.en).toBe('Greninja may be a combination of grenouille (French for "frog") and ninja.')
    expect(notes.de).toBe('From Quak (croak) and Ninjutsu')
    expect(notes.ja).toBe('From げこっ geko (croak) and 月光 gekkō')
})

test('gives the Mandarin meaning to both Chinese scripts, and skips empty or unused languages', () => {
    // One Mandarin name is written in both scripts; Cantonese has no column of ours.
    const notes = originsOf(PAGE, new Set())
    const languages = notes.map(([language]) => language)

    expect(Object.fromEntries(notes).zh_hans).toBe('From 甲賀 Jiǎhè (Kōga) and 忍蛙 rěnwā')
    expect(Object.fromEntries(notes).zh_hant).toBe(Object.fromEntries(notes).zh_hans)
    expect(languages).not.toContain('fr')
    expect(languages).not.toContain('zh_yue')
})
