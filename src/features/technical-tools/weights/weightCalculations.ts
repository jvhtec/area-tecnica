export type WeightComponent = {
  id: number | string;
  name: string;
  weight: number;
};

export type WeightTableRow = {
  quantity: string;
  componentId: string;
  weight: string;
  componentName?: string;
  totalWeight?: number;
};

export type CalculatedWeightTableRow<Row extends WeightTableRow> = Row & {
  componentName: string;
  totalWeight: number;
};

export const calculateWeightRows = <Row extends WeightTableRow, Component extends WeightComponent>(
  rows: Row[],
  components: Component[],
): CalculatedWeightTableRow<Row>[] =>
  rows.map((row) => {
    const component = components.find((candidate) => candidate.id.toString() === row.componentId);
    const quantity = Number.parseFloat(row.quantity || "0");
    const weight = Number.parseFloat(row.weight || "0");
    const totalWeight = quantity && weight ? quantity * weight : 0;

    return {
      ...row,
      componentName: component?.name || row.componentName || "",
      totalWeight,
    };
  });

export const sumWeightRows = (rows: Pick<WeightTableRow, "totalWeight">[]) =>
  rows.reduce((sum, row) => sum + (row.totalWeight || 0), 0);

export const formatRiggingPoint = (prefix: string, value: number) => `${prefix}${value.toString().padStart(2, "0")}`;
