import { AppComponents, WsData } from '../../types'

export async function registerRoomHandler(components: Pick<AppComponents, 'server' | 'logs'>) {
  const { logs, server } = components
  const logger = logs.getLogger('room-handler')

  let connectionCounter = 0

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
}
