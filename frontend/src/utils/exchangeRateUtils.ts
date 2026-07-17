export interface RateRecord {
  from_currency: string;
  to_currency: string;
  rate: number | string;
  [key: string]: unknown;
}

/**
 * Calculates the effective exchange rate between two currencies using BFS.
 * Mirrors the backend logic for consistency.
 */
export const calculateEffectiveRate = (from: string, to: string, exchangeRates: RateRecord[]): number | null => {
  if (from === to) return 1;
  if (!exchangeRates || exchangeRates.length === 0) return null;

  const graph: Record<string, Record<string, number>> = {};

  exchangeRates.forEach(r => {
    const f = r.from_currency.toUpperCase();
    const t = r.to_currency.toUpperCase();
    const v = parseFloat(String(r.rate));

    if (!graph[f]) graph[f] = {};
    if (!graph[t]) graph[t] = {};

    if (graph[f][t] === undefined) graph[f][t] = v;
    if (graph[t][f] === undefined) graph[t][f] = 1 / v;
  });

  const targetFrom = from.toUpperCase();
  const targetTo = to.toUpperCase();

  const queue: { node: string; cumulativeRate: number }[] = [{ node: targetFrom, cumulativeRate: 1 }];
  const visited = new Set([targetFrom]);

  while (queue.length > 0) {
    const { node, cumulativeRate } = queue.shift()!;

    if (node === targetTo) {
      return cumulativeRate;
    }

    const neighbors = graph[node];
    if (neighbors) {
      for (const [neighborCurrency, edgeRate] of Object.entries(neighbors)) {
        if (!visited.has(neighborCurrency)) {
          visited.add(neighborCurrency);
          queue.push({
            node: neighborCurrency,
            cumulativeRate: cumulativeRate * (edgeRate as number)
          });
        }
      }
    }
  }

  return null;
};

/**
 * Converts an amount from one currency to another using the BFS calculation.
 */
export const convertCurrency = (amount: number | string, from: string, to: string, rates: RateRecord[]): number | null => {
  const rate = calculateEffectiveRate(from, to, rates);
  return rate !== null ? parseFloat(String(amount)) * rate : null;
};
