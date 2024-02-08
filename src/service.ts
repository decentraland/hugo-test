import { Lifecycle } from '@well-known-components/interfaces'
import { registerMetricsHandler } from './controllers/handlers/metricsHandler'
import { registerRoomHandler } from './controllers/handlers/roomHandler'
import { registerStatusHandler } from './controllers/handlers/statusHandler'
import { AppComponents, TestComponents } from './types'

export async function main(program: Lifecycle.EntryPointParameters<AppComponents | TestComponents>) {
  const { components, startComponents } = program

  const { server } = components

  await Promise.all([
    registerStatusHandler(components),
    registerMetricsHandler(components),
    registerRoomHandler(components)
  ])

  server.app.get('/health/live', (res) => {
    res.writeStatus('200 OK')
    res.end('alive')
  })

  // server.app.filter(async (res, count) => {
  //   console.log(res, count)
  // })

  // start ports: db, listeners, synchronizations, etc
  await startComponents()
}
