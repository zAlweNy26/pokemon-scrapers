import { defineConfig } from 'vite'
import { voidPlugin } from 'void'

export default defineConfig({
    plugins: [voidPlugin()],
    // Elysia's CORS plugin owns preflights; Vite's dev CORS would answer them first.
    server: { cors: false }
})
