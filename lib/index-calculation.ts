import { BitcoinDirectionIndex, LiquidityData, ISMPMIData, BitcoinPrice } from './types';

/**
 * Calculate z-score normalization
 */
function calculateZScore(value: number, mean: number, stdDev: number): number {
  if (stdDev === 0) return 0;
  return (value - mean) / stdDev;
}

/**
 * Calculate mean and standard deviation from an array of numbers
 */
function calculateStats(values: number[]): { mean: number; stdDev: number } {
  if (values.length === 0) {
    return { mean: 0, stdDev: 1 }; // Default to avoid division by zero
  }
  
  const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
  const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
  const stdDev = Math.sqrt(variance);
  
  // If stdDev is 0 (all values are the same), use a small value to avoid division by zero
  // This happens when historical data is insufficient or all the same
  return { mean, stdDev: stdDev || 1 };
}

/**
 * Calculate Bitcoin trend score based on price momentum
 * Returns a value between -1 and 1
 */
function calculateBTCTrend(
  currentPrice: number,
  historicalPrices: number[]
): number {
  if (historicalPrices.length < 2) return 0;

  // Calculate short-term (last 7 days) vs medium-term (last 30 days) average
  const shortTerm = historicalPrices.slice(-7);
  const mediumTerm = historicalPrices.slice(-30);

  if (shortTerm.length === 0 || mediumTerm.length === 0) return 0;

  const shortTermAvg = shortTerm.reduce((sum, p) => sum + p, 0) / shortTerm.length;
  const mediumTermAvg = mediumTerm.reduce((sum, p) => sum + p, 0) / mediumTerm.length;

  // Normalize trend to -1 to 1 range
  if (mediumTermAvg === 0) return 0;
  const trend = (shortTermAvg - mediumTermAvg) / mediumTermAvg;
  return Math.max(-1, Math.min(1, trend * 10)); // Scale and clamp
}

/**
 * Calculate the Bitcoin Direction Index
 * Combines liquidity, PMI, and BTC trend into a 0-100 index
 */
export function calculateBitcoinDirectionIndex(
  liquidity: LiquidityData,
  liquidityHistory: number[],
  pmi: ISMPMIData,
  pmiHistory: number[],
  btcPrice: BitcoinPrice,
  btcPriceHistory: number[]
): BitcoinDirectionIndex {
  // Calculate z-scores for liquidity
  const liquidityStats = calculateStats(liquidityHistory);
  const liquidityZScore = calculateZScore(
    liquidity.liquidity,
    liquidityStats.mean,
    liquidityStats.stdDev
  );

  // Calculate z-score for PMI
  // PMI above 50 is expansion, below 50 is contraction
  // We normalize around 50
  const pmiNormalized = pmi.value - 50; // Center around 0
  const pmiStats = calculateStats(pmiHistory.map(p => p - 50));
  const pmiZScore = calculateZScore(pmiNormalized, pmiStats.mean, pmiStats.stdDev);

  // Calculate BTC trend
  const btcTrend = calculateBTCTrend(btcPrice.price, btcPriceHistory);

  // Weighted combination
  // Liquidity: 40% weight (most important per video)
  // PMI: 35% weight (business cycle indicator)
  // BTC Trend: 25% weight (momentum)
  const weights = {
    liquidity: 0.4,
    pmi: 0.35,
    btcTrend: 0.25,
  };

  // Normalize z-scores to -1 to 1 range (clamp extreme values)
  const normalizedLiquidity = Math.max(-2, Math.min(2, liquidityZScore)) / 2;
  const normalizedPMI = Math.max(-2, Math.min(2, pmiZScore)) / 2;

  // Calculate weighted index (range: -1 to 1)
  const rawIndex =
    weights.liquidity * normalizedLiquidity +
    weights.pmi * normalizedPMI +
    weights.btcTrend * btcTrend;

  // Convert to 0-100 scale (0 = very bearish, 100 = very bullish)
  const index = ((rawIndex + 1) / 2) * 100;

  // Determine interpretation
  let interpretation: BitcoinDirectionIndex['interpretation'];
  if (index < 20) {
    interpretation = 'very_bearish';
  } else if (index < 40) {
    interpretation = 'bearish';
  } else if (index < 60) {
    interpretation = 'neutral';
  } else if (index < 80) {
    interpretation = 'bullish';
  } else {
    interpretation = 'very_bullish';
  }

  return {
    index: Math.round(index * 100) / 100, // Round to 2 decimals
    liquidityZScore,
    pmiZScore,
    btcTrend,
    timestamp: Date.now(),
    interpretation,
  };
}

/**
 * Calculate correlation coefficient between index and Bitcoin price
 */
export function calculateCorrelation(
  indexValues: number[],
  priceValues: number[]
): number {
  if (indexValues.length !== priceValues.length || indexValues.length < 2) {
    return 0;
  }

  const n = indexValues.length;
  const indexMean = indexValues.reduce((sum, val) => sum + val, 0) / n;
  const priceMean = priceValues.reduce((sum, val) => sum + val, 0) / n;

  let numerator = 0;
  let indexVariance = 0;
  let priceVariance = 0;

  for (let i = 0; i < n; i++) {
    const indexDiff = indexValues[i] - indexMean;
    const priceDiff = priceValues[i] - priceMean;
    numerator += indexDiff * priceDiff;
    indexVariance += indexDiff * indexDiff;
    priceVariance += priceDiff * priceDiff;
  }

  const denominator = Math.sqrt(indexVariance * priceVariance);
  if (denominator === 0) return 0;

  return numerator / denominator;
}

