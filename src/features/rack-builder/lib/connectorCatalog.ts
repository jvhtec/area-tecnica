import type { ConnectorCategory, ConnectorDefinition } from '../types'

const CATEGORY_ORDER: ConnectorCategory[] = ['audio', 'data', 'power', 'multipin', 'other']

export function buildConnectorById(connectors: ConnectorDefinition[]): Map<string, ConnectorDefinition> {
  return new Map(connectors.map((connector) => [connector.id, connector]))
}

export function groupedConnectors(connectors: ConnectorDefinition[]): Array<{ category: ConnectorCategory; items: ConnectorDefinition[] }> {
  return CATEGORY_ORDER
    .map((category) => ({
      category,
      items: connectors.filter((item) => item.category === category),
    }))
    .filter((group) => group.items.length > 0)
}
