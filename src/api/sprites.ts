/** Sizes produced by the scraper's Bun.Image ladder and uploaded to R2. */
export const SPRITE_SIZES = [96, 256, 512] as const

export type Sprites = Record<string, string>

export const spritesFor = (baseUrl: string, key: string | null): Sprites | null => {
    if (!key) return null

    return Object.fromEntries(
        SPRITE_SIZES.map((size) => [String(size), `${baseUrl}/${key}/${size}.webp`])
    )
}
