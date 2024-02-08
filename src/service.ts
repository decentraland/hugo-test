import { Lifecycle } from '@well-known-components/interfaces'
import { AppComponents, TestComponents, WsData } from './types'

let connectionCounter = 0

export async function main(program: Lifecycle.EntryPointParameters<AppComponents | TestComponents>) {
  const { components, startComponents } = program

  const { server, config, logs } = components

  const commitHash = (await config.getString('COMMIT_HASH')) || 'unknown'

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

  server.app.filter(async (res, count) => {
    console.log(res, count)
  })

  // start ports: db, listeners, synchronizations, etc
  await startComponents()
}
