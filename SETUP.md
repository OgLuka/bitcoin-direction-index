# Quick Setup Guide

## 1. Install Dependencies

```bash
npm install
```

## 2. Get FRED API Key (Free)

1. Visit: https://fred.stlouisfed.org/docs/api/api_key.html
2. Sign up for a free account
3. Generate an API key
4. Create `.env.local` file in the root directory:

```env
FRED_API_KEY=your_api_key_here
```

**Note**: The app will work with the `demo` key, but it has strict rate limits. Get your own key for production use.

## 3. Run the Development Server

```bash
npm run dev
```

Visit http://localhost:3000 to see the dashboard.

## 4. Understanding the Data

### US Liquidity Components

- **Fed Balance Sheet (WALCL)**: Total assets held by the Federal Reserve
- **Treasury General Account (TGA)**: Treasury's operating account at the Fed
- **Reverse Repo (RRP)**: Overnight reverse repurchase agreements
- **US Liquidity**: Calculated as `Fed Balance Sheet - TGA - RRP`

### ISM Manufacturing PMI

- Currently uses FRED's NAPM as a proxy
- For accurate ISM PMI, you'll need to:
  - Manually update monthly from https://www.ismworld.org/
  - Or integrate with a paid data provider (Bloomberg, Quandl, etc.)

### Bitcoin Direction Index

The index combines:
- **40%**: US Liquidity (z-score normalized)
- **35%**: ISM PMI (normalized around 50)
- **25%**: Bitcoin price momentum (short vs medium-term)

## 5. Testing the Correlation

To test if the index correlates with Bitcoin price:

1. The app calculates correlation when historical data is available
2. For accurate correlation analysis, you'll need to:
   - Store historical index values in a database
   - Store historical Bitcoin prices
   - Calculate correlation over time periods (30-day, 90-day, etc.)

## Troubleshooting

### API Errors

- **FRED API**: Check your API key is correct in `.env.local`
- **Bitcoin API**: Coinbase API is public and should work without issues
- **PMI**: If you see placeholder data, that's expected - integrate a real PMI source

### Build Errors

- Make sure all dependencies are installed: `npm install`
- Check TypeScript errors: `npm run build`

### Data Not Updating

- The dashboard auto-refreshes every 60 seconds
- Click the "Refresh" button to manually update
- Check browser console for API errors

