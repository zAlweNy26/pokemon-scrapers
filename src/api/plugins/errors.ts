import { Elysia } from 'elysia'
import { Problem } from '../problem'

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

export const errors = new Elysia({ name: 'errors' })
    .onError(({ code, error, set, path }) => {
        set.headers['content-type'] = PROBLEM_JSON
        // Failures are per-request and must never be cached at the edge.
        set.headers['cache-control'] = 'no-store'

        if (error instanceof Problem) {
            set.status = error.status
            for (const [header, value] of Object.entries(error.headers))
                set.headers[header] = value

            return { ...error.toJSON(), instance: path }
        }

        switch (code) {
            case 'NOT_FOUND':
                set.status = 404
                return {
                    type: '/errors/not-found',
                    title: 'Not Found',
                    status: 404,
                    detail: 'No route matches this path.',
                    instance: path
                }

            case 'VALIDATION': {
                set.status = 422

                // Elysia's `message` is a JSON dump of the whole TypeBox failure.
                // `all` carries the individual issues, which make a far better
                // problem document; fall back only if the shape ever changes.
                const issues = describe(error)

                return {
                    type: '/errors/validation-failed',
                    title: 'Unprocessable Content',
                    status: 422,
                    detail: issues[0]?.message ?? 'The request failed validation.',
                    errors: issues,
                    instance: path
                }
            }

            case 'PARSE':
                set.status = 400
                return {
                    type: '/errors/bad-request',
                    title: 'Bad Request',
                    status: 400,
                    detail: 'The request body could not be parsed.',
                    instance: path
                }

            default:
                // Surfaces in `void project logs`; the client is told nothing internal.
                console.error(JSON.stringify({ level: 'error', path, code, message: String(error) }))
                set.status = 500
                return {
                    type: '/errors/internal',
                    title: 'Internal Server Error',
                    status: 500,
                    instance: path
                }
        }
    })
    .as('global')
