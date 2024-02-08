import { AppComponents } from '../../types'
import { Registry } from 'prom-client'

export const CONFIG_PREFIX = 'WKC_METRICS' as const

export function _configKey(key: Uppercase<string>): string {
  return `${CONFIG_PREFIX}_${key.toUpperCase().replace(/^(_*)/, '')}`
}

export async function registerMetricsHandler(components: Pick<AppComponents, 'config' | 'server' | 'metrics'>) {
  const { metrics, config, server } = components

  const metricsPath = (await config.getString(_configKey('PUBLIC_PATH'))) || '/metrics'
  const bearerToken = await config.getString(_configKey('BEARER_TOKEN'))
  const rotateMetrics = (await config.getString(_configKey('RESET_AT_NIGHT'))) === 'true'

  function calculateNextReset() {
    return new Date(new Date(new Date().toDateString()).getTime() + 86400000).getTime()
  }

  let nextReset: number = calculateNextReset()

  server.app.get(metricsPath, async (res, req): Promise<void> => {
    const body = await (metrics as any as { registry: Registry }).registry.metrics()

    if (bearerToken) {
      const header = req.getHeader('authorization')
      if (!header) {
        res.writeStatus('401 Forbidden')
        res.end()
        return
      }
      const [_, value] = header.split(' ')
      if (value !== bearerToken) {
        res.writeStatus('401 Forbidden')
        res.end()
        return
      }
    }

    // heavy-metric servers that run for long hours tend to generate precision problems
    // and memory degradation for histograms if not cleared enough. this method
    // resets the metrics once per day at 00.00UTC
    if (rotateMetrics && Date.now() > nextReset) {
      nextReset = calculateNextReset()
      metrics.resetAll()
    }

    res.writeStatus('200 OK')
    res.writeHeader('content-type', 'application/json')
    res.end(body)
  })
}
