export interface Region {
    index: number
    href: string
    name: string
}

export interface GameLocation {
    game: string
    location: string
}

export interface PokemonBase {
    index: number
    gen: number
    ndex: string
    name: string
    types: string[]
}

export interface PokemonSerebii extends PokemonBase {
    subIndex: number
    region: number
    depositable: boolean
    form: string
}

export interface PokemonBulbapedia {
    index: number
    name: string
    ndex: string
    gen: number
    height: number
    heightUnit: string
    weight: number
    weightUnit: string
    types: string[]
    category: string
    catchRate: number
    genderRatio: number
    locations: Record<string, GameLocation[]>
}