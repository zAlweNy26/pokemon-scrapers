import { defineConfig } from 'vite'
import { voidPlugin } from 'void'

export default defineConfig({
    plugins: [voidPlugin()],
    // The `@/*` alias lives in tsconfig.json; Bun and tsc read it from there too.
    resolve: { tsconfigPaths: true },
    // Elysia's CORS plugin owns preflights; Vite's dev CORS would answer them first.
    server: { cors: false }
})
