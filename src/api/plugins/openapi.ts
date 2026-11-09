import { Elysia } from 'elysia'
import { openapi } from '@elysiajs/openapi'
import { z } from 'zod'
import { RATE_LIMITS } from '@/api/platform'

// Inline so the Worker serves no static asset. A house, not a Poke Ball: the API
// is unaffiliated. The pink matches the sidebar accent in Elysia's Scalar theme.
const favicon = `data:image/svg+xml,${encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">' +
        '<rect width="32" height="32" rx="8" fill="#f06292"/>' +
        '<path d="M16 6 5 15h3v11h6v-7h4v7h6V15h3z" fill="#fff"/>' +
        '</svg>'
)}`

/**
 * Scalar UI at /docs, machine-readable spec at /openapi.json.
 *
 * The spec is generated from the same zod schemas that validate requests and
 * serialise responses, so documentation cannot drift from behaviour - a wrong
 * doc would be a failing request.
 */
export const documentation = new Elysia({ name: 'documentation' }).use(
    openapi({
        path: '/docs',
        // The plugin knows TypeBox natively and needs an explicit converter for
        // any Standard Schema validator.
        //
        // Both options are load-bearing. Bare `z.toJSONSchema` throws on a schema
        // containing a transform (the boolean query parameter), and the plugin
        // swallows that - silently emitting an endpoint with no parameters at all.
        // `io: 'input'` is also the correct view for documentation: it describes
        // what a client sends ("true"/"false", defaults optional) rather than what
        // the handler receives after parsing.
        mapJsonSchema: {
            zod: (schema: z.ZodType) =>
                z.toJSONSchema(schema, { io: 'input', unrepresentable: 'any' })
        },
        specPath: '/openapi.json',
        // The <title> comes from info.title ("homedex"), which also names the spec;
        // metaData overrides only the browser tab once Scalar loads.
        scalar: { favicon, metaData: { title: 'homedex · API reference' } },
        exclude: { paths: ['/health'] },
        documentation: {
            info: {
                title: 'homedex',
                version: '1.0.0',
                description: [
                    'Pokemon data focused on what general-purpose APIs cover poorly:',
                    'Pokemon HOME depositability, names in all nine game languages,',
                    'real form handling, per-game encounter locations and name etymology.',
                    '',
                    `**Rate limits.** ${RATE_LIMITS.global} requests per ${RATE_LIMITS.windowSeconds}s per IP overall, ${RATE_LIMITS.search} per ${RATE_LIMITS.windowSeconds}s for`,
                    '`/v1/search`. Limits are enforced per Cloudflare location.',
                    '',
                    '**Caching.** Responses carry strong ETags derived from the dataset',
                    'version. Send `If-None-Match` and you will get a 304 for free.',
                    '',
                    '**Licence.** Data is CC BY-NC-SA 2.5, inherited from Bulbapedia.',
                    'Non-commercial use only. Not affiliated with Nintendo, Game Freak',
                    'or The Pokemon Company.'
                ].join('\n'),
                license: {
                    name: 'CC BY-NC-SA 2.5',
                    url: 'https://creativecommons.org/licenses/by-nc-sa/2.5/'
                }
            },
            tags: [
                { name: 'Pokemon', description: 'Species and their forms' },
                { name: 'Search', description: 'Cross-language name search' },
                { name: 'Reference', description: 'Generations, games and types' },
                { name: 'Meta', description: 'Dataset provenance and versioning' }
            ]
        }
    })
)
