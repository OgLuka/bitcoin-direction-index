export interface FREDData {
  date: string;
  value: number;
}

export interface BitcoinPrice {
  price: number;
  timestamp: number;
  change24h?: number;
}

export interface ISMPMIData {
  value: number;
  date: string;
  change?: number;
  note?: string;
  source?: string;
}

export interface LiquidityData {
  fedBalanceSheet: number;
  tga: number;
  rrp: number;
  liquidity: number; // calculated: fedBalanceSheet - tga - rrp
  date: string;
}

export interface BitcoinDirectionIndex {
  index: number; // 0-100 scale
  liquidityZScore: number;
  pmiZScore: number;
  btcTrend: number;
  timestamp: number;
  interpretation: 'very_bearish' | 'bearish' | 'neutral' | 'bullish' | 'very_bullish';
}

export interface DashboardData {
  bitcoinPrice: BitcoinPrice;
  liquidity: LiquidityData;
  pmi: ISMPMIData;
  directionIndex: BitcoinDirectionIndex;
  correlation?: number; // correlation between index and BTC price over time
}

