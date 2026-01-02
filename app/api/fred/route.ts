import { NextResponse } from 'next/server';
import axios from 'axios';

const FRED_API_KEY = process.env.FRED_API_KEY || 'demo'; // Users need to get their own key from https://fred.stlouisfed.org/docs/api/api_key.html

interface FREDObservation {
  date: string;
  value: string;
}

interface FREDResponse {
  observations: FREDObservation[];
}

async function fetchFREDSeries(seriesId: string): Promise<{ date: string; value: number }[]> {
  try {
    const url = `https://api.stlouisfed.org/fred/series/observations`;
    const params = {
      series_id: seriesId,
      api_key: FRED_API_KEY,
      file_type: 'json',
      limit: 365, // Get last year of data
      sort_order: 'desc',
    };

    const response = await axios.get<FREDResponse>(url, { params });
    
    return response.data.observations
      .filter(obs => obs.value !== '.')
      .map(obs => ({
        date: obs.date,
        value: parseFloat(obs.value),
      }))
      .reverse(); // Reverse to get chronological order
  } catch (error) {
    console.error(`Error fetching FRED series ${seriesId}:`, error);
    throw error;
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const series = searchParams.get('series') || 'all';

    if (series === 'all') {
      // Fetch all three series in parallel
      const [fedBalanceSheet, tga, rrp] = await Promise.all([
        fetchFREDSeries('WALCL'), // Fed Balance Sheet
        fetchFREDSeries('WTREGEN'), // Treasury General Account
        fetchFREDSeries('RRPONTSYD'), // Reverse Repo (Overnight)
      ]);

      // Get the latest values
      const latestFed = fedBalanceSheet[fedBalanceSheet.length - 1];
      const latestTGA = tga[tga.length - 1];
      const latestRRP = rrp[rrp.length - 1];

      // Calculate liquidity: Fed Balance Sheet - TGA - RRP
      const liquidity = latestFed.value - latestTGA.value - latestRRP.value;

      return NextResponse.json({
        fedBalanceSheet: {
          current: latestFed.value,
          data: fedBalanceSheet,
        },
        tga: {
          current: latestTGA.value,
          data: tga,
        },
        rrp: {
          current: latestRRP.value,
          data: rrp,
        },
        liquidity: {
          current: liquidity,
          date: latestFed.date,
        },
      });
    } else {
      // Fetch single series
      const data = await fetchFREDSeries(series);
      return NextResponse.json({ data });
    }
  } catch (error: any) {
    console.error('Error in FRED API route:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch FRED data' },
      { status: 500 }
    );
  }
}

