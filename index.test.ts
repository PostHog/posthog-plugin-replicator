import { enableFetchMocks } from 'jest-fetch-mock'
import fetch from 'node-fetch'

enableFetchMocks()

import { Plugin, PluginMeta } from '@posthog/plugin-scaffold'
// @ts-ignore
import { createPageview, resetMeta as resetMetaRaw } from '@posthog/plugin-scaffold/test/utils'

import * as index from '.'

const { processEvent } = index as Required<Plugin>

jest.spyOn(global, 'fetch')

async function resetMeta(): Promise<index.ReplicatorMeta> {
    return resetMetaRaw({
        config: {
            host: 'example.com',
            project_api_key: 'xyz',
        },
    }) as index.ReplicatorMeta
}

test('event is enriched with IP location', async () => {
    const event = await processEvent(createPageview(), await resetMeta())
    expect(fetch).toHaveBeenCalledWith()
})
