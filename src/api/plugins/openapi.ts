import { Elysia } from 'elysia'
import { openapi } from '@elysiajs/openapi'
import { z } from 'zod'

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
                    '**Rate limits.** 120 requests/minute per IP overall, 20/minute for',
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
                { name: 'Reference', description: 'Generations and types' },
                { name: 'Meta', description: 'Dataset provenance and versioning' }
            ]
        }
    })
)
