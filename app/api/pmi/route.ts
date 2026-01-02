import { NextResponse } from 'next/server';
import axios from 'axios';

// Note: ISM PMI data is not freely available via API
// This is a workaround using alternative sources or manual data entry
// For production, you'd want to use a paid API or scrape ISM's website (with permission)

interface PMIData {
  value: number;
  date: string;
  change?: number;
}

// Alternative: Use Markit PMI or other sources
// For now, we'll use a mock/fallback approach
// You can manually update this or integrate with a data provider

export async function GET() {
  try {
    // Option 1: Try to fetch from Trading Economics API (requires key)
    // Option 2: Use FRED's alternative PMI series if available
    // Option 3: Manual data entry or web scraping (with proper permissions)
    
    // For now, using a placeholder that you can replace with actual data
    // Check if there's a FRED series for PMI
    const FRED_API_KEY = process.env.FRED_API_KEY || 'demo';
    
    try {
      // Try to get PMI from FRED (they have some PMI-related series)
      // Note: ISM PMI might not be directly available, but we can use alternatives
      const response = await axios.get(
        'https://api.stlouisfed.org/fred/series/observations',
        {
          params: {
            series_id: 'NAPM', // NAPM is an older PMI series, or use 'MANEMP' for manufacturing employment
            api_key: FRED_API_KEY,
            file_type: 'json',
            limit: 12,
            sort_order: 'desc',
          },
        }
      );

      const observations = response.data.observations
        .filter((obs: any) => obs.value !== '.')
        .map((obs: any) => ({
          date: obs.date,
          value: parseFloat(obs.value),
        }));

      if (observations.length > 0) {
        const latest = observations[observations.length - 1];
        const previous = observations.length > 1 ? observations[observations.length - 2] : latest;
        const change = latest.value - previous.value;

        return NextResponse.json({
          value: latest.value,
          date: latest.date,
          change: change,
          source: 'FRED_NAPM',
          note: 'Using NAPM as proxy. For accurate ISM PMI, consider using a paid data provider or manual entry.',
        });
      }
    } catch (fredError) {
      console.log('FRED PMI fetch failed, using fallback');
    }

    // Fallback: Return a placeholder structure
    // In production, you should:
    // 1. Get an API key from a data provider (Bloomberg, Quandl, etc.)
    // 2. Manually update this value monthly from ISM's website
    // 3. Use web scraping (with proper permissions and rate limiting)
    
    return NextResponse.json({
      value: 50, // Neutral PMI (50 is the threshold)
      date: new Date().toISOString().split('T')[0],
      change: 0,
      source: 'placeholder',
      note: 'This is placeholder data. Please integrate with a real PMI data source. ISM PMI is published monthly at https://www.ismworld.org/',
    });
  } catch (error: any) {
    console.error('Error fetching PMI data:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch PMI data',
        note: 'ISM PMI requires manual entry or a paid API. Please update the PMI value manually or integrate with a data provider.',
      },
      { status: 500 }
    );
  }
}

