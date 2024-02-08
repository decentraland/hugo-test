import { HTTPProvider } from 'eth-connect'
import { createDotEnvConfigComponent } from '@well-known-components/env-config-provider'
import { createLogComponent } from '@well-known-components/logger'
import { AppComponents } from './types'
import { metricDeclarations } from './metrics'
import { createFetchComponent } from '@well-known-components/fetch-component'
import { createUWsComponent } from './adapters/uws'
import { createMetricsComponent } from './adapters/metrics'

const DEFAULT_ETH_NETWORK = 'goerli'

// Initialize all the components of the app
export async function initComponents(): Promise<AppComponents> {
  const config = await createDotEnvConfigComponent({
    path: ['.env.default', '.env']
  })

  const ethNetwork = (await config.getString('ETH_NETWORK')) ?? DEFAULT_ETH_NETWORK

  const logs = await createLogComponent({})
  const fetch = createFetchComponent()
  const server = await createUWsComponent({ config, logs }, {})
  const metrics = await createMetricsComponent(metricDeclarations, { config})
  const ethereumProvider = new HTTPProvider(
    `https://rpc.decentraland.org/${encodeURIComponent(ethNetwork)}?project=mini-comms`,
    { fetch: fetch.fetch }
  )

  return {
    server,
    config,
    logs,
    fetch,
    metrics,
    ethereumProvider
  }
}
