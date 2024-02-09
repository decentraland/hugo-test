import { Lifecycle } from '@well-known-components/interfaces'
import { HttpRequest, HttpResponse } from 'uWebSockets.js'
import { createMetricsHandler } from './controllers/handlers/metricsHandler'
import { registerRoomHandler } from './controllers/handlers/roomHandler'
import { createStatusHandler } from './controllers/handlers/statusHandler'
import { AppComponents, IHandler, TestComponents } from './types'

const noopStartTimer = { end() {} }

export async function main(program: Lifecycle.EntryPointParameters<AppComponents | TestComponents>) {
  const { components, startComponents } = program

  const { server, metrics } = components

  function wrap(h: IHandler) {
    return async (res: HttpResponse, req: HttpRequest) => {
      const labels = {
        method: req.getMethod(),
        handler: req.getUrl(),
        code: 500
      }
      const startTimerResult = metrics.startTimer('http_request_duration_seconds', labels)
      const end = startTimerResult?.end || noopStartTimer.end

      let status = 500
      try {
        const result = await h(res, req)
        status = result.status ?? 200
        res.writeStatus(`${status}`)

        const headers = new Headers(result.headers ?? {})

        // TODO:
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
        labels.code = status
        metrics.increment('http_requests_total', labels)
        end(labels)
      }
    }
  }

  await registerRoomHandler(components)

  server.app.get('/status', wrap(await createStatusHandler(components)))

  {
    const { path, handler } = await createMetricsHandler(components)
    server.app.get(path, wrap(handler))
  }

  server.app.get(
    '/health/live',
    wrap(async () => {
      return {
        body: 'alive'
      }
    })
  )

  server.app.any(
    '/*',
    wrap(async () => {
      return {
        status: 404,
        body: { error: 'Not Found' }
      }
    })
  )

  // start ports: db, listeners, synchronizations, etc
  await startComponents()
}
