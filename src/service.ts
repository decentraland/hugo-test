import { Lifecycle } from '@well-known-components/interfaces'
import { AppComponents, TestComponents, WsData } from './types'
import { Registry } from "prom-client"

let connectionCounter = 0

export const CONFIG_PREFIX = "WKC_METRICS" as const
export function _configKey(key: Uppercase<string>): string {
  return `${CONFIG_PREFIX}_${key.toUpperCase().replace(/^(_*)/, "")}`
}

export async function main(program: Lifecycle.EntryPointParameters<AppComponents | TestComponents>) {
  const { components, startComponents } = program

  const { server, config, logs, metrics } = components

  const commitHash = (await config.getString('COMMIT_HASH')) || 'unknown'


  const metricsPath = (await components.config.getString(_configKey("PUBLIC_PATH"))) || "/metrics"
  const bearerToken = await components.config.getString(_configKey("BEARER_TOKEN"))
  const rotateMetrics = await components.config.getString(_configKey("RESET_AT_NIGHT")) == 'true'

  function calculateNextReset() {
    return new Date(new Date(new Date().toDateString()).getTime() + 86400000).getTime()
  }

  let nextReset: number = calculateNextReset()

  server.app.get(metricsPath, async (res, req) : Promise<void> => {
    const body = await (metrics as any as { registry: Registry}).registry.metrics()

    if (bearerToken) {
      const header = req.getHeader('authorization')
      console.log(header, typeof header)
      if (!header) {
        res.writeStatus('401 Forbidden')
        res.end()
        return
      }
      const [_, value] = header.split(" ")
      console.log("HERE", value, bearerToken)
      if (value != bearerToken) {
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

  server.app.get('/health/live', (res) => {
    res.writeStatus('200 OK')
    res.end('alive')
  })

  server.app.get('/status', (res) => {
    res.writeStatus('200 OK')
    res.writeHeader('content-type', 'application/json')
    res.writeHeader('Access-Control-Allow-Origin', '*')
    res.end(
      JSON.stringify({
        commitHash: commitHash
      })
    )
  })

  const logger = logs.getLogger('server')
  server.app.ws<WsData>('/rooms/:roomId', {
    upgrade: (res, req, context) => {
      /* This immediately calls open handler, you must not use res after this call */
      res.upgrade(
        {
          alias: ++connectionCounter,
          roomId: req.getParameter(0)
        },
        req.getHeader('sec-websocket-key'),
        req.getHeader('sec-websocket-protocol'),
        req.getHeader('sec-websocket-extensions'),
        context
      )
    },
    open: (ws) => {
      const data = ws.getUserData()
      console.log(data)
    },
    close: (_ws, _code, _message) => {
      logger.debug('Websocket closed')
    }
  })

  // server.app.filter(async (res, count) => {
  //   console.log(res, count)
  // })

  // start ports: db, listeners, synchronizations, etc
  await startComponents()
}
