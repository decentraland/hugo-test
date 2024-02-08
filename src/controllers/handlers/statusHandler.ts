import { AppComponents } from '../../types'

export async function registerStatusHandler(components: Pick<AppComponents, 'config' | 'server'>) {
  const { server, config } = components
  const commitHash = (await config.getString('COMMIT_HASH')) || 'unknown'

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
}
