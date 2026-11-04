/**
 * RFC 9457 problem details. Handlers throw these; the error plugin renders them.
 * Keeping construction and rendering apart means every failure leaves the API
 * in one shape, including the ones Elysia raises on our behalf.
 */
export class Problem extends Error {
    constructor(
        readonly status: number,
        readonly type: string,
        readonly title: string,
        readonly detail?: string,
        /** Extra response headers this failure requires, e.g. Retry-After on a 429. */
        readonly headers: Record<string, string> = {}
    ) {
        super(detail ?? title)
        this.name = 'Problem'
    }

    toJSON() {
        return {
            type: this.type,
            title: this.title,
            status: this.status,
            ...(this.detail ? { detail: this.detail } : {})
        }
    }
}

export const notFound = (detail: string) =>
    new Problem(404, '/errors/not-found', 'Not Found', detail)

export const badRequest = (detail: string) =>
    new Problem(400, '/errors/bad-request', 'Bad Request', detail)

export const unprocessable = (detail: string) =>
    new Problem(422, '/errors/validation-failed', 'Unprocessable Content', detail)

export const rateLimited = (retryAfterSeconds: number) =>
    new Problem(
        429,
        '/errors/rate-limited',
        'Too Many Requests',
        'Rate limit exceeded. See the documentation for current limits.',
        // The limiter cannot know when the window resets, so this advertises the
        // whole window: an upper bound never sends a client back early.
        { 'retry-after': String(retryAfterSeconds) }
    )
