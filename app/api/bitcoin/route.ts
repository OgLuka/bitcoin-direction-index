import { NextResponse } from 'next/server';
import axios from 'axios';

interface CoinbaseTicker {
  price: string;
  time: string;
}

interface CoinbaseStats {
  open: string;
  high: string;
  low: string;
  volume: string;
  last: string;
  volume_30day: string;
}

export async function GET() {
  try {
    // Fetch 24h stats for price and change calculation
    const statsResponse = await axios.get<CoinbaseStats>(
      'https://api.exchange.coinbase.com/products/BTC-USD/stats'
    );

    const currentPrice = parseFloat(statsResponse.data.last);
    const openPrice = parseFloat(statsResponse.data.open);
    const change24h = ((currentPrice - openPrice) / openPrice) * 100;

    return NextResponse.json({
      price: currentPrice,
      timestamp: Date.now(),
      change24h: change24h,
      high24h: parseFloat(statsResponse.data.high),
      low24h: parseFloat(statsResponse.data.low),
      volume24h: parseFloat(statsResponse.data.volume),
    });
  } catch (error: any) {
    console.error('Error fetching Bitcoin price:', error);
    
    // Fallback to alternative API
    try {
      const fallbackResponse = await axios.get(
        'https://api.coinbase.com/v2/prices/BTC-USD/spot'
      );
      return NextResponse.json({
        price: parseFloat(fallbackResponse.data.data.amount),
        timestamp: Date.now(),
        change24h: 0,
      });
    } catch (fallbackError) {
      return NextResponse.json(
        { error: 'Failed to fetch Bitcoin price' },
        { status: 500 }
      );
    }
  }
}

