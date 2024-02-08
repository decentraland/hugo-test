import { getDefaultHttpMetrics, validateMetricsDeclaration } from './adapters/metrics'

export const metricDeclarations = {
  ...getDefaultHttpMetrics()
}

// type assertions
validateMetricsDeclaration(metricDeclarations)
