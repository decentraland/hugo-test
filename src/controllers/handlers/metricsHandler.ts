import { AppComponents, IHandler } from '../../types'
import { Registry } from 'prom-client'

export const CONFIG_PREFIX = 'WKC_METRICS' as const

export function _configKey(key: Uppercase<string>): string {
  return `${CONFIG_PREFIX}_${key.toUpperCase().replace(/^(_*)/, '')}`
}

export async function createMetricsHandler(
  components: Pick<AppComponents, 'config' | 'metrics'>
): Promise<{ path: string; handler: IHandler }> {
  const { metrics, config } = components

  const metricsPath = (await config.getString(_configKey('PUBLIC_PATH'))) || '/metrics'
  const bearerToken = await config.getString(_configKey('BEARER_TOKEN'))
  const rotateMetrics = (await config.getString(_configKey('RESET_AT_NIGHT'))) === 'true'

  function calculateNextReset() {
    return new Date(new Date(new Date().toDateString()).getTime() + 86400000).getTime()
  }

  let nextReset: number = calculateNextReset()

  const handler: IHandler = async (_res, req) => {
    const body = await (metrics as any as { registry: Registry }).registry.metrics()

    if (bearerToken) {
      const header = req.getHeader('authorization')
      if (!header) {
        return { status: 401 }
      }
      const [_, value] = header.split(' ')
      if (value !== bearerToken) {
        return { status: 401 }
      }
    }

    // heavy-metric servers that run for long hours tend to generate precision problems
    // and memory degradation for histograms if not cleared enough. this method
    // resets the metrics once per day at 00.00UTC
    if (rotateMetrics && Date.now() > nextReset) {
      nextReset = calculateNextReset()
      metrics.resetAll()
    }

    return {
      headers: { 'content-type': 'application/json' },
      body
    }
  }

  return { path: metricsPath, handler }
}
