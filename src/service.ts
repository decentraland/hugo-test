import { Lifecycle } from '@well-known-components/interfaces'
import { onRequestEnd, onRequestStart } from './adapters/metrics'
import { setupRoutes } from './controllers/routers'
import { AppComponents, TestComponents } from './types'

export async function main(program: Lifecycle.EntryPointParameters<AppComponents | TestComponents>) {
  const { components, startComponents } = program
  const { server, metrics } = components

  await setupRoutes(components)

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
