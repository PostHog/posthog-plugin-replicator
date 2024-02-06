import { Plugin, Webhook } from '@posthog/plugin-scaffold'

export interface ReplicatorMetaInput {
    config: {
        host: string
        project_api_key: string
        replication: string
        events_to_ignore: string
        disable_geoip: 'Yes' | 'No'
    }
}

const plugin: Plugin<ReplicatorMetaInput> = {
    composeWebhook: (event, { config }) => {
        const replication = parseInt(config.replication) || 1
        if (replication > 1) {
            // This is a quick fix to make sure we don't become a spam bot
            throw new Error('Replication factor > 1 is not allowed')
        }

        const eventsToIgnore = new Set(
            config.events_to_ignore && config.events_to_ignore.trim() !== ''
                ? config.events_to_ignore.split(',').map((event) => event.trim())
                : null
        )
        if (eventsToIgnore.has(event.event)) {
            return null
        }

        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { team_id, ...sendableEvent } = { ...event, token: config.project_api_key }

        if (config.disable_geoip === 'Yes') {
            sendableEvent.properties.$geoip_disable = true
        }

        const batch = []
        for (let i = 0; i < replication; i++) {
            batch.push(sendableEvent)
        }

        if (batch.length === 0) {
            return null
        }

        return {
            url: `https://${config.host.replace(/\/$/, '')}/e`,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(batch),
            method: 'POST',
        } as Webhook
    },
}

export default plugin
