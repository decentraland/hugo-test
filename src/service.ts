import { Lifecycle } from '@well-known-components/interfaces'
import { HttpRequest, HttpResponse } from 'uWebSockets.js'
import { onRequestEnd, onRequestStart } from './adapters/metrics'
import { createMetricsHandler } from './controllers/handlers/metricsHandler'
import { registerRoomHandler } from './controllers/handlers/roomHandler'
import { createStatusHandler } from './controllers/handlers/statusHandler'
import { AppComponents, IHandler, TestComponents } from './types'

export async function main(program: Lifecycle.EntryPointParameters<AppComponents | TestComponents>) {
  const { components, startComponents } = program

  const { server, metrics } = components

  function wrap(h: IHandler) {
    return async (res: HttpResponse, req: HttpRequest) => {
      const { labels, end } = onRequestStart(metrics, req.getMethod(), h.path)
      let status = 500
      try {
        const result = await h.f(res, req)
        status = result.status ?? 200
        res.writeStatus(`${status}`)

        const headers = new Headers(result.headers ?? {})

        if (!headers.has('Access-Control-Allow-Origin')) {
          headers.set('Access-Control-Allow-Origin', '*')
        }

        headers.forEach((v, k) => res.writeHeader(k, v))

        if (result.body === undefined) {
          res.end()
        } else if (typeof result.body === 'string') {
          res.end(result.body)
        } else {
          res.writeHeader('content-type', 'application/json')
          res.end(JSON.stringify(result.body))
        }
      } catch (err) {
        res.writeStatus(`${status}`)
        res.end()
      } finally {
        onRequestEnd(metrics, labels, status, end)
      }
    }
  }

  await registerRoomHandler(components)

  {
    const handler = await createStatusHandler(components)
    server.app.get(handler.path, wrap(handler))
  }

  {
    const handler = await createMetricsHandler(components)
    server.app.get(handler.path, wrap(handler))
  }

  server.app.any('/health/live', (res, req) => {
    const { end, labels } = onRequestStart(metrics, req.getMethod(), '/health/live')
    res.writeStatus('200 OK')
    res.writeHeader('Access-Control-Allow-Origin', '*')
    res.end('alive')
    onRequestEnd(metrics, labels, 404, end)
  })

  server.app.any('/*', (res, req) => {
    const { end, labels } = onRequestStart(metrics, req.getMethod(), '')
    res.writeStatus('404 Not Found')
    res.writeHeader('Access-Control-Allow-Origin', '*')
    res.writeHeader('content-type', 'application/json')
    res.end(JSON.stringify({ error: 'Not Found' }))
    onRequestEnd(metrics, labels, 404, end)
  })

  // start ports: db, listeners, synchronizations, etc
  await startComponents()
}
