export const CONNECTOR_ITEM_TYPE = 'PANEL_CONNECTOR'
export const PLACED_PORT_TYPE = 'PANEL_PLACED_PORT'

export interface ConnectorDragItem {
  type: typeof CONNECTOR_ITEM_TYPE
  connectorId: string
  gridWidth: number
  gridHeight: number
}

export interface PlacedPortDragItem {
  type: typeof PLACED_PORT_TYPE
  portId: string
  connectorId: string
  gridWidth: number
  gridHeight: number
}
