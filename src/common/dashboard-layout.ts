export interface DashboardLayout {
  focus: boolean;
  order: string[];
  hidden: string[];
}

export function parseDashboardLayout(value: unknown): DashboardLayout {
  const data = (
    value && typeof value === 'object' ? value : {}
  ) as Partial<DashboardLayout>;

  const list = (value: unknown): string[] =>
    Array.isArray(value)
      ? [
          ...new Set(
            value.filter(
              (id): id is string =>
                typeof id === 'string' && id.length > 0 && id.length < 250,
            ),
          ),
        ].slice(0, 100)
      : [];

  return {
    focus: data.focus === true,
    order: list(data.order),
    hidden: list(data.hidden),
  };
}

export function orderedTileIds(ids: string[], order: string[]): string[] {
  const known = new Set(ids);
  return [
    ...order.filter((id) => known.has(id)),
    ...ids.filter((id) => !order.includes(id)),
  ];
}
