/** Sizes produced by `bun run data:sprites` and uploaded to R2. 475 is the official artwork's own size: never upscaled. */
export const SPRITE_SIZES = [96, 256, 475] as const

export type Sprites = Record<string, string>

export const spritesFor = (baseUrl: string, key: string | null): Sprites | null => {
    if (!key) return null

    return Object.fromEntries(
        SPRITE_SIZES.map((size) => [String(size), `${baseUrl}/${key}/${size}.webp`])
    )
}
