import { NextResponse } from 'next/server';
import axios from 'axios';
import { calculateBitcoinDirectionIndex, calculateCorrelation } from '@/lib/index-calculation';
import { DashboardData } from '@/lib/types';

const FRED_API_KEY = process.env.FRED_API_KEY || 'demo';

async function fetchFREDSeries(seriesId: string) {
  try {
    const response = await axios.get('https://api.stlouisfed.org/fred/series/observations', {
      params: {
        series_id: seriesId,
        api_key: FRED_API_KEY,
        file_type: 'json',
        limit: 365,
        sort_order: 'desc',
      },
    });

    return response.data.observations
      .filter((obs: any) => obs.value !== '.')
      .map((obs: any) => ({
        date: obs.date,
        value: parseFloat(obs.value),
      }))
      .reverse();
  } catch (error) {
    console.error(`Error fetching ${seriesId}:`, error);
    return [];
  }
}

async function fetchBitcoinPrice() {
  try {
    const response = await axios.get('https://api.exchange.coinbase.com/products/BTC-USD/stats');
    const tickerResponse = await axios.get('https://api.coinbase.com/v2/exchange-rates?currency=BTC');
    
    const currentPrice = parseFloat(response.data.last);
    const openPrice = parseFloat(response.data.open);
    const change24h = ((currentPrice - openPrice) / openPrice) * 100;

    return {
      price: currentPrice,
      timestamp: Date.now(),
      change24h,
    };
  } catch (error) {
    console.error('Error fetching Bitcoin price:', error);
    throw error;
  }
}

async function fetchPMI() {
  try {
    const response = await axios.get('https://api.stlouisfed.org/fred/series/observations', {
      params: {
        series_id: 'NAPM',
        api_key: FRED_API_KEY,
        file_type: 'json',
        limit: 12,
        sort_order: 'desc',
      },
    });

    const observations = response.data.observations
      .filter((obs: any) => obs.value !== '.')
      .map((obs: any) => parseFloat(obs.value));

    if (observations.length > 0) {
      return {
        value: observations[observations.length - 1],
        date: response.data.observations[response.data.observations.length - 1].date,
        change: observations.length > 1 ? observations[observations.length - 1] - observations[observations.length - 2] : 0,
      };
    }
  } catch (error) {
    console.error('Error fetching PMI:', error);
  }

  // Fallback
  return {
    value: 50,
    date: new Date().toISOString().split('T')[0],
    change: 0,
  };
}

export async function GET() {
  try {
    // Fetch all data in parallel
    const [fedData, tgaData, rrpData, btcPrice, pmi] = await Promise.all([
      fetchFREDSeries('WALCL'),
      fetchFREDSeries('WTREGEN'),
      fetchFREDSeries('RRPONTSYD'),
      fetchBitcoinPrice(),
      fetchPMI(),
    ]);

    // Calculate liquidity
    const latestFed = fedData[fedData.length - 1];
    const latestTGA = tgaData[tgaData.length - 1];
    const latestRRP = rrpData[rrpData.length - 1];

    const liquidity = {
      fedBalanceSheet: latestFed.value,
      tga: latestTGA.value,
      rrp: latestRRP.value,
      liquidity: latestFed.value - latestTGA.value - latestRRP.value,
      date: latestFed.date,
    };

    // Prepare historical data for index calculation
    const liquidityHistory = fedData.map((f: { date: string; value: number }, i: number) => {
      const tgaVal = tgaData[i]?.value || 0;
      const rrpVal = rrpData[i]?.value || 0;
      return f.value - tgaVal - rrpVal;
    });

    const pmiHistory = Array(12).fill(pmi.value); // Simplified - in production, fetch historical PMI

    // For BTC price history, we'll use a simplified approach
    // In production, you'd fetch historical prices
    const btcPriceHistory = Array(30).fill(btcPrice.price); // Placeholder

    // Calculate direction index
    const directionIndex = calculateBitcoinDirectionIndex(
      liquidity,
      liquidityHistory,
      pmi,
      pmiHistory,
      btcPrice,
      btcPriceHistory
    );

    // Calculate correlation (simplified - would need historical index values)
    // For now, we'll return 0 as placeholder
    const correlation = 0;

    const dashboardData: DashboardData = {
      bitcoinPrice: btcPrice,
      liquidity,
      pmi,
      directionIndex,
      correlation,
    };

    return NextResponse.json(dashboardData);
  } catch (error: any) {
    console.error('Error in dashboard API:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch dashboard data' },
      { status: 500 }
    );
  }
}

