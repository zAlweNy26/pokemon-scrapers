import { Elysia } from 'elysia'
import { Problem, internal, notFound, unprocessable } from '../problem'

const PROBLEM_JSON = 'application/problem+json'

interface Issue {
    property?: string
    message: string
}

/**
 * Turns a validation failure into problem-document issues, each naming its own
 * field. Elysia gives every issue a `path` ("limit", or "/limit" for TypeBox);
 * a path naming nothing useful ("" or "root") is omitted rather than misleading.
 */
const describe = (error: unknown): Issue[] => {
    const { all } = error as { all?: unknown }
    if (!Array.isArray(all)) return []

    return all.flatMap((issue) => {
        if (typeof issue !== 'object' || issue === null) return []

        const { summary, message, path } = issue as { summary?: string; message?: string; path?: unknown }
        const text = summary ?? message
        if (!text) return []

        const property = typeof path === 'string' ? path.replace(/^\//, '') : ''

        return [property && property !== 'root' ? { property, message: text } : { message: text }]
    })
}

/**
 * Maps a failure Elysia raises on our behalf onto the Problem a handler would
 * have thrown. Every route is GET, so there is no request body to fail parsing.
 */
const toProblem = (code: string | number, error: unknown, path: string): Problem => {
    switch (code) {
        case 'NOT_FOUND':
            return notFound('No route matches this path.')

        case 'VALIDATION': {
            const issues = describe(error)
            return unprocessable(issues[0]?.message ?? 'The request failed validation.', issues)
        }

        default:
            // Surfaces in `void project logs`; the client is told nothing internal.
            console.error(JSON.stringify({ level: 'error', path, code, message: String(error) }))
            return internal()
    }
}

export const errors = new Elysia({ name: 'errors' })
    .onError(({ code, error, set, path }) => {
        const problem = error instanceof Problem ? error : toProblem(code, error, path)

        set.status = problem.status
        set.headers['content-type'] = PROBLEM_JSON
        // Failures are per-request and must never be cached at the edge.
        set.headers['cache-control'] = 'no-store'
        for (const [header, value] of Object.entries(problem.headers)) set.headers[header] = value

        return { ...problem.toJSON(), instance: path }
    })
    .as('global')
