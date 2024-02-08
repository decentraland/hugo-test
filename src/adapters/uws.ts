import { IBaseComponent } from '@well-known-components/interfaces'
import * as uws from 'uWebSockets.js'
import { AppComponents } from '../types'

export type IUWsComponent = IBaseComponent & {
  app: uws.TemplatedApp
}

export async function createUWsComponent(
  components: Pick<AppComponents, 'config' | 'logs'>,
  options?: uws.AppOptions
): Promise<IUWsComponent> {
  const { config, logs } = components
  const port = await config.requireNumber('HTTP_SERVER_PORT')
  const host = await config.requireString('HTTP_SERVER_HOST')

  const logger = logs.getLogger('http-server')

  const app = uws.App(options)
  async function start() {
    return new Promise<void>((resolve, reject) => {
      try {
        app.listen(host, port, () => {
          logger.log(`Listening ${host}:${port}`)
          resolve()
        })
      } catch (err) {
        reject(err)
      }
    })
  }

  async function stop() {
    // TODO https://github.com/uNetworking/uWebSockets.js/blob/master/examples/GracefulShutdown.js#L14
    app.close()
  }

  return {
    app,
    start,
    stop
  }
}
