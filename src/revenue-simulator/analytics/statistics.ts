export interface NumericStatistics {
  count: number;
  mean: number;
  variance: number;
  standardDeviation: number;
  minimum: number;
  maximum: number;
}

export function calculateNumericStatistics(values: number[]): NumericStatistics {
  if (!values.length) {
    return { count: 0, mean: 0, variance: 0, standardDeviation: 0, minimum: 0, maximum: 0 };
  }
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance =
    values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
  return {
    count: values.length,
    mean,
    variance,
    standardDeviation: Math.sqrt(variance),
    minimum: Math.min(...values),
    maximum: Math.max(...values),
  };
}
