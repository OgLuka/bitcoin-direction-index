'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { DashboardData } from '@/lib/types';
import { TrendingUp, TrendingDown, Minus, RefreshCw, AlertCircle } from 'lucide-react';
import { BTCChart } from '@/components/btc-chart';

export function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch('/api/dashboard');
      if (!response.ok) {
        throw new Error('Failed to fetch dashboard data');
      }
      const dashboardData = await response.json();
      setData(dashboardData);
      setLastUpdate(new Date());
    } catch (err: any) {
      setError(err.message || 'Failed to load data');
      console.error('Error fetching dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // Auto-refresh every 60 seconds
    const interval = setInterval(fetchData, 60000);
    return () => clearInterval(interval);
  }, []);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatNumber = (value: number, decimals: number = 2) => {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(value);
  };

  const getInterpretationBadge = (interpretation: string) => {
    const variants: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
      very_bearish: { label: 'Very Bearish', variant: 'destructive' },
      bearish: { label: 'Bearish', variant: 'destructive' },
      neutral: { label: 'Neutral', variant: 'secondary' },
      bullish: { label: 'Bullish', variant: 'default' },
      very_bullish: { label: 'Very Bullish', variant: 'default' },
    };

    const config = variants[interpretation] || variants.neutral;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const getTrendIcon = (value: number) => {
    if (value > 0) return <TrendingUp className="h-4 w-4 text-green-500" />;
    if (value < 0) return <TrendingDown className="h-4 w-4 text-red-500" />;
    return <Minus className="h-4 w-4 text-gray-500" />;
  };

  if (loading && !data) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <Skeleton className="h-32 w-full" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-48 w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="container mx-auto p-6">
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-destructive" />
              Error Loading Data
            </CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
          <CardContent>
            <button
              onClick={fetchData}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
            >
              Retry
            </button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Bitcoin Direction Index</h1>
          <p className="text-muted-foreground mt-1">
            Real-time analysis based on US liquidity, PMI, and Bitcoin momentum
          </p>
        </div>
        <button
          onClick={fetchData}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Main Index Card */}
      <Card className="border-2">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-2xl">Bitcoin Direction Index</CardTitle>
              <CardDescription>
                Combined indicator (0-100 scale)
              </CardDescription>
            </div>
            {getInterpretationBadge(data.directionIndex.interpretation)}
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <div className="text-5xl font-bold mb-2">
                {formatNumber(data.directionIndex.index, 1)}
              </div>
              <div className="w-full bg-secondary rounded-full h-4">
                <div
                  className="bg-primary h-4 rounded-full transition-all duration-500"
                  style={{ width: `${data.directionIndex.index}%` }}
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <div className="text-muted-foreground">Liquidity Z-Score</div>
                <div className="font-semibold">{formatNumber(data.directionIndex.liquidityZScore, 2)}</div>
              </div>
              <div>
                <div className="text-muted-foreground">PMI Z-Score</div>
                <div className="font-semibold">{formatNumber(data.directionIndex.pmiZScore, 2)}</div>
              </div>
              <div>
                <div className="text-muted-foreground">BTC Trend</div>
                <div className="font-semibold">{formatNumber(data.directionIndex.btcTrend, 2)}</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Chart Section */}
      <BTCChart />

      {/* Bitcoin Price */}
      <Card>
        <CardHeader>
          <CardTitle>Bitcoin Price</CardTitle>
          <CardDescription>Current BTC/USD price</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="text-3xl font-bold">
              {formatCurrency(data.bitcoinPrice.price)}
            </div>
            {data.bitcoinPrice.change24h !== undefined && (
              <div className="flex items-center gap-2">
                {getTrendIcon(data.bitcoinPrice.change24h)}
                <span className={data.bitcoinPrice.change24h >= 0 ? 'text-green-500' : 'text-red-500'}>
                  {formatNumber(data.bitcoinPrice.change24h, 2)}% (24h)
                </span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* US Liquidity Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Fed Balance Sheet</CardTitle>
            <CardDescription>Total Fed Assets</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(data.liquidity.fedBalanceSheet)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Treasury General Account</CardTitle>
            <CardDescription>TGA Balance</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(data.liquidity.tga)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Reverse Repo</CardTitle>
            <CardDescription>RRP Facility</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(data.liquidity.rrp)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">US Liquidity</CardTitle>
            <CardDescription>Fed - TGA - RRP</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(data.liquidity.liquidity)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* PMI */}
      <Card>
        <CardHeader>
          <CardTitle>ISM Manufacturing PMI</CardTitle>
          <CardDescription>
            {data.pmi.value >= 50 ? 'Expansion' : 'Contraction'} ({data.pmi.date})
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="text-3xl font-bold">
              {formatNumber(data.pmi.value, 1)}
            </div>
            {data.pmi.change !== undefined && data.pmi.change !== 0 && (
              <div className="flex items-center gap-2">
                {getTrendIcon(data.pmi.change)}
                <span className={data.pmi.change >= 0 ? 'text-green-500' : 'text-red-500'}>
                  {formatNumber(data.pmi.change, 1)} change
                </span>
              </div>
            )}
            {data.pmi.note && (
              <p className="text-xs text-muted-foreground mt-2">{data.pmi.note}</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Correlation Info */}
      {data.correlation !== undefined && data.correlation !== 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Index Correlation</CardTitle>
            <CardDescription>Correlation between index and Bitcoin price</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatNumber(data.correlation, 3)}
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              {data.correlation > 0.7
                ? 'Strong positive correlation'
                : data.correlation > 0.3
                ? 'Moderate positive correlation'
                : data.correlation > -0.3
                ? 'Weak correlation'
                : 'Negative correlation'}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Last Update */}
      {lastUpdate && (
        <div className="text-center text-sm text-muted-foreground">
          Last updated: {lastUpdate.toLocaleString()}
        </div>
      )}
    </div>
  );
}

