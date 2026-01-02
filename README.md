# Bitcoin Direction Index

A real-time web application that calculates a Bitcoin Direction Index based on US liquidity metrics (Federal Reserve balance sheet, Treasury General Account, Reverse Repo), ISM Manufacturing PMI, and Bitcoin price momentum.

## Features

- **Real-time Bitcoin Price**: Live BTC/USD price from Coinbase API
- **US Liquidity Metrics**:
  - Federal Reserve Balance Sheet (WALCL)
  - Treasury General Account (TGA)
  - Reverse Repo Facility (RRP)
  - Calculated US Liquidity (Fed - TGA - RRP)
- **ISM Manufacturing PMI**: Business cycle indicator
- **Bitcoin Direction Index**: Composite 0-100 index combining all factors
- **Correlation Analysis**: Tracks correlation between the index and Bitcoin price

## Getting Started

### Prerequisites

- Node.js 18+
- npm, yarn, pnpm, or bun

### Installation

1. Clone the repository:

```bash
git clone <your-repo-url>
cd bitcoin-direction-index
```

2. Install dependencies:

```bash
npm install
```

3. Set up environment variables:

Create a `.env.local` file in the root directory:

```env
# FRED API Key (Free - Get yours at https://fred.stlouisfed.org/docs/api/api_key.html)
# The demo key works but has rate limits. For production, get your own key.
FRED_API_KEY=demo
```

**Note**: To get your free FRED API key:

1. Visit https://fred.stlouisfed.org/docs/api/api_key.html
2. Sign up for a free account
3. Generate an API key
4. Add it to your `.env.local` file

### Running the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the dashboard.

## How It Works

The Bitcoin Direction Index combines three key factors:

1. **US Liquidity (40% weight)**: Calculated as Fed Balance Sheet - TGA - RRP, normalized using z-scores
2. **ISM PMI (35% weight)**: Manufacturing PMI indicator, normalized around 50 (expansion/contraction threshold)
3. **Bitcoin Trend (25% weight)**: Short-term vs medium-term price momentum

The index ranges from 0-100:

- 0-20: Very Bearish
- 20-40: Bearish
- 40-60: Neutral
- 60-80: Bullish
- 80-100: Very Bullish

## Data Sources

- **FRED API**: Federal Reserve Economic Data for liquidity metrics
- **Coinbase API**: Real-time Bitcoin price data
- **ISM PMI**: Currently uses FRED's NAPM as a proxy (for accurate ISM PMI, manual entry or paid API required)

## Project Structure

```
├── app/
│   ├── api/
│   │   ├── bitcoin/      # Bitcoin price API
│   │   ├── dashboard/     # Combined dashboard data
│   │   ├── fred/          # FRED data API
│   │   └── pmi/           # PMI data API
│   ├── layout.tsx
│   └── page.tsx
├── components/
│   ├── dashboard.tsx      # Main dashboard component
│   └── ui/                # shadcn/ui components
├── lib/
│   ├── index-calculation.ts  # Index calculation logic
│   ├── types.ts              # TypeScript types
│   └── utils.ts              # Utility functions
└── package.json
```

## Technologies Used

- **Next.js 16**: React framework
- **TypeScript**: Type safety
- **shadcn/ui**: UI components
- **Tailwind CSS**: Styling
- **Axios**: HTTP client
- **FRED API**: Economic data
- **Coinbase API**: Cryptocurrency prices

## Limitations & Future Improvements

- **ISM PMI**: Currently uses a proxy indicator. For production, integrate with a paid data provider or implement manual monthly updates
- **Historical Correlation**: Correlation calculation requires historical data storage (database) for accurate analysis
- **Real-time Updates**: Consider WebSocket connections for true real-time price updates
- **Charts**: Add historical charts using Recharts library (already installed)

## License

MIT
