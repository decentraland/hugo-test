import { AppComponents, IHandler } from '../../types'

export async function createStatusHandler(components: Pick<AppComponents, 'config' | 'server'>): Promise<IHandler> {
  const { config } = components
  const commitHash = (await config.getString('COMMIT_HASH')) || 'unknown'

  return async () => {
    return {
      body: {
        commitHash
      }
    }
  }
}
