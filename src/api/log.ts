type Sink = (line: string) => void

let sink: Sink = (line) => console.log(line)

/**
 * Swaps where request logs go. Tests use this to capture them; patching
 * `console.log` is not reliable, because Bun's test runner reinstalls it
 * around every test.
 */
export const setLogSink = (next: Sink) => {
    sink = next
}

/**
 * One JSON object per request on stdout, which is what `void project logs` and
 * Workers Logs both ingest. No logging dependency, no shipping pipeline.
 *
 * This is called from src/api/handler.ts rather than an Elysia
 * `onAfterResponse` hook: that hook runs after the response has been returned,
 * and workerd tears the request context down at that point, so the line is
 * simply never written. It logs locally under `bun test` and silently vanishes
 * in production - which is the worst possible failure mode for a log.
 *
 * Note on `duration`: workerd freezes the clock between I/O operations, so this
 * measures time spanning I/O (a D1 query) rather than raw CPU. Treat it as a
 * coarse signal, not a profiler.
 */
export const logRequest = (request: Request, status: number, duration: number) => {
    sink(
        JSON.stringify({
            level: 'info',
            method: request.method,
            path: new URL(request.url).pathname,
            status,
            duration,
            ip: request.headers.get('CF-Connecting-IP') ?? undefined,
            ray: request.headers.get('CF-Ray') ?? undefined
        })
    )
}
