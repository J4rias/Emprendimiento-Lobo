/**
 * Calculates the effective exchange rate between two currencies using a Breadth-First Search (BFS) algorithm.
 * This mirrors the logic used in the backend to ensure consistency.
 * 
 * @param {string} from - Source currency code (e.g., 'USD')
 * @param {string} to - Destination currency code (e.g., 'VES')
 * @param {Array} exchangeRates - Array of exchange rate objects from the API
 * @returns {number|null} The calculated rate or null if no path is found
 */
export const calculateEffectiveRate = (from, to, exchangeRates) => {
    if (from === to) return 1;
    if (!exchangeRates || exchangeRates.length === 0) return null;

    // 1. Build Adjacency Graph from available rates
    // graph = { 'USD': { 'VES': rate1, 'COP': rate2 }, 'VES': { 'USD': 1/rate1 } }
    const graph = {};

    exchangeRates.forEach(r => {
        const f = r.from_currency.toUpperCase(); // Direct from
        const t = r.to_currency.toUpperCase();   // Direct to
        const v = parseFloat(r.rate);

        if (!graph[f]) graph[f] = {};
        if (!graph[t]) graph[t] = {};

        // Adjacency for both directions (Direct and Inverse)
        // First encounter (usually latest from sorted API) wins
        if (graph[f][t] === undefined) graph[f][t] = v;
        if (graph[t][f] === undefined) graph[t][f] = 1 / v;
    });

    const targetFrom = from.toUpperCase();
    const targetTo = to.toUpperCase();

    // 2. BFS to find the shortest path and multiply rates
    const queue = [{ node: targetFrom, cumulativeRate: 1 }];
    const visited = new Set([targetFrom]);

    while (queue.length > 0) {
        const { node, cumulativeRate } = queue.shift();

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
                        cumulativeRate: cumulativeRate * edgeRate
                    });
                }
            }
        }
    }

    return null;
};

/**
 * Converts an amount from one currency to another using the BFS calculation.
 * 
 * @param {number} amount - Amount to convert
 * @param {string} from - Source currency
 * @param {string} to - Target currency
 * @param {Array} rates - Available exchange rates
 * @returns {number|null} Converted amount or null if no rate exists
 */
export const convertCurrency = (amount, from, to, rates) => {
    const rate = calculateEffectiveRate(from, to, rates);
    return rate !== null ? parseFloat(amount) * rate : null;
};
