import { Meta, PostHogEvent } from '@posthog/plugin-scaffold'

import plugin, { ReplicatorMetaInput } from '../index'

const captureHost = 'localhost:8000'
const captureUrl = `https://${captureHost}/e`

const meta: Meta<ReplicatorMetaInput> = {
    attachments: {},
    cache: {
        set: async () => {
            //
        },
        get: async () => {
            //
        },
        incr: async () => 1,
        expire: async () => true,
        lpush: async () => 1,
        lrange: async () => [],
        llen: async () => 1,
        lpop: async () => [],
        lrem: async () => 1,
    },
    config: {
        host: captureHost,
        project_api_key: 'test',
        replication: '1',
        events_to_ignore: 'my-event-alpha, my-event-beta, my-event-gamma',
        disable_geoip: 'No',
    },
    geoip: {
        locate: async () => null,
    },
    global: {},
    jobs: {},
    metrics: {},
    storage: {
        set: async () => {
            //
        },
        get: async () => {
            //
        },
        del: async () => {
            //
        },
    },
    utils: {
        cursor: {
            init: async () => {
                //
            },
            increment: async () => 1,
        },
    },
}

const mockEvent: PostHogEvent = {
    uuid: '10000000-0000-4000-0000-000000000000',
    team_id: 1,
    distinct_id: '1234',
    event: 'my-event',
    timestamp: new Date(),
    properties: {
        $ip: '127.0.0.1',
        $elements_chain: 'div:nth-child="1"nth-of-type="2"text="text"',
        foo: 'bar',
    },
}

const mockEventsToIgnore: Array<PostHogEvent> = [
    {
        uuid: '10000000-0000-4000-0000-000000000000',
        team_id: 1,
        distinct_id: '1234',
        event: 'my-event-alpha',
        timestamp: new Date(),
        properties: {
            $ip: '127.0.0.1',
            $elements_chain: 'div:nth-child="1"nth-of-type="2"text="text"',
            foo: 'bar',
        },
    },
    {
        uuid: '20000000-0000-4000-0000-000000000000',
        team_id: 1,
        distinct_id: '1234',
        event: 'my-event-beta',
        timestamp: new Date(),
        properties: {
            $ip: '127.0.0.1',
            $elements_chain: 'div:nth-child="1"nth-of-type="2"text="text"',
            foo: 'bar',
        },
    },
    {
        uuid: '30000000-0000-4000-0000-000000000000',
        team_id: 1,
        distinct_id: '1234',
        event: 'my-event-gamma',
        timestamp: new Date(),
        properties: {
            $ip: '127.0.0.1',
            $elements_chain: 'div:nth-child="1"nth-of-type="2"text="text"',
            foo: 'bar',
        },
    },
]

describe('payload contents', () => {
    describe('event pre-processing', () => {
        it('should handle a single event', () => {
            if (!plugin.composeWebhook) {
                throw new Error('Not implemented')
            }

            const webhook = plugin.composeWebhook(mockEvent, meta)

            expect(webhook).toHaveProperty('url', captureUrl)
            expect(webhook?.headers).toMatchObject({ 'Content-Type': 'application/json' })
            expect(webhook).toHaveProperty('method', 'POST')

            const desiredWebhookBody = {
                token: meta.config.project_api_key,
                uuid: mockEvent.uuid,
                distinct_id: mockEvent.distinct_id,
                event: mockEvent.event,
                timestamp: mockEvent.timestamp,
                properties: mockEvent.properties,
            }

            // We have to do this parse -> stringify dance for the date string (timestamp)
            expect(JSON.parse(webhook?.body || '')).toMatchObject(JSON.parse(JSON.stringify([desiredWebhookBody])))
        })

        it('should skip ignored events', () => {
            if (!plugin.composeWebhook) {
                throw new Error('Not implemented')
            }

            for (const event of mockEventsToIgnore) {
                expect(plugin.composeWebhook(event, meta)).toBeNull()
            }

            expect(plugin.composeWebhook(mockEvent, meta)).not.toBeNull()
        })

        it('respects disable_geoip setting', () => {
            if (!plugin.composeWebhook) {
                throw new Error('Not implemented')
            }

            const metaWithGeoIPIgnore: Meta<ReplicatorMetaInput> = {
                ...meta,
                config: { ...meta.config, disable_geoip: 'Yes' },
            }

            const webhook = plugin.composeWebhook(mockEvent, metaWithGeoIPIgnore)

            const desiredWebhookBody = {
                token: meta.config.project_api_key,
                uuid: mockEvent.uuid,
                distinct_id: mockEvent.distinct_id,
                event: mockEvent.event,
                timestamp: mockEvent.timestamp,
                properties: { ...mockEvent.properties, $geoip_disable: true },
            }

            expect(JSON.parse(webhook?.body || '')).toMatchObject(JSON.parse(JSON.stringify([desiredWebhookBody])))
        })

        it('throws on replication > 1', () => {
            if (!plugin.composeWebhook) {
                throw new Error('Not implemented')
            }

            const metaWith10Replication: Meta<ReplicatorMetaInput> = {
                ...meta,
                config: { ...meta.config, replication: '10' },
            }

            expect(() => {
                if (!plugin.composeWebhook) {
                    throw new Error('Not implemented')
                }
                plugin.composeWebhook(mockEvent, metaWith10Replication)
            }).toThrow(new Error('Replication factor > 1 is not allowed'))
        })

        it('should reuse the values for timestamp, event, uuid', async () => {
            // This is important to ensure that we end up sending the correct
            // values for the properties that we dedup.
            // NOTE: we should be reasonably confident that these are the
            // values we'd receive as per the functional test here:
            // https://github.com/PostHog/posthog/blob/771691e8bdd6bf4465887b88d0a6019c9b4b91d6/plugin-server/functional_tests/exports-v2.test.ts#L151

            if (!plugin.composeWebhook) {
                throw new Error('Not implemented')
            }

            const timestamp = new Date()

            const webhoook = plugin.composeWebhook(
                {
                    uuid: 'i-am-a-uuid',
                    distinct_id: '1234',
                    event: 'my-event',
                    timestamp,
                    team_id: 100,
                    properties: {},
                },
                meta
            )

            if (webhoook === null) {
                throw new Error('Webhook is null')
            }

            const webhookBody: Array<Record<string, unknown>> = JSON.parse(webhoook.body)

            expect(webhookBody.length).toEqual(1)

            webhookBody.forEach((e) => {
                expect(e).toHaveProperty('uuid', 'i-am-a-uuid')
                expect(e).toHaveProperty('event', 'my-event')
                expect(e).toHaveProperty('timestamp', timestamp.toISOString())
            })
        })
    })
})
