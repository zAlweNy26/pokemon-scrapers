import { Elysia } from 'elysia'
import { Problem } from '../problem'

const PROBLEM_JSON = 'application/problem+json'

interface Issue {
    property?: string
    message: string
}

/**
 * Turns a TypeBox failure into problem-document issues.
 *
 * Elysia validates query and param properties one at a time and throws on the
 * first failure, so this reports one issue in practice rather than every problem
 * with the request - it is a description, not an exhaustive audit.
 *
 * The failing property name only exists inside Elysia's JSON `message`, never on
 * the error instance, so it is parsed out defensively and simply omitted if the
 * shape ever changes.
 */
const propertyOf = (error: unknown): string | undefined => {
    const { message } = error as { message?: unknown }
    if (typeof message !== 'string') return undefined

    try {
        const { property } = JSON.parse(message) as { property?: unknown }
        if (typeof property !== 'string') return undefined

        const name = property.replace(/^\//, '')

        // Elysia reports 'root' when a coerced scalar (a numeric query param)
        // fails, which names nothing useful - better to omit than mislead.
        return name && name !== 'root' ? name : undefined
    } catch {
        return undefined
    }
}

const describe = (error: unknown): Issue[] => {
    const { all } = error as { all?: unknown }
    if (!Array.isArray(all)) return []

    const property = propertyOf(error)

    return all.flatMap((issue) => {
        if (typeof issue !== 'object' || issue === null) return []

        const { summary, message } = issue as { summary?: string; message?: string }
        const text = summary ?? message
        if (!text) return []

        return [property ? { property, message: text } : { message: text }]
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
