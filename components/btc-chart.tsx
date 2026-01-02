"use client";

import { useState } from "react";
import { useQueries } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { AlertCircle } from "lucide-react";

type Timespan = "1D" | "7D" | "30D" | "90D" | "1Y" | "ALL";

interface ChartDataPoint {
  timestamp: number;
  date: string;
  price: number;
  index: number | null;
}

interface ChartData {
  data: ChartDataPoint[];
  timespan: Timespan;
  count: number;
}

// Fetch function for Bitcoin history
async function fetchBitcoinHistory(timespan: Timespan) {
  const response = await fetch(`/api/bitcoin/history?timespan=${timespan}`);
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: "Unknown error" }));
    
    if (response.status === 429 || error.error?.includes("rate limit")) {
      throw new Error(
        "API rate limit exceeded. CoinGecko has rate limits on free tier. Please wait a moment and try again, or use a shorter timespan."
      );
    }
    
    throw new Error(`Bitcoin API error: ${error.error || response.statusText}`);
  }
  
  const data = await response.json();
  
  if (!data.data || data.data.length === 0) {
    throw new Error("No Bitcoin price data available");
  }
  
  return data;
}

// Fetch function for index history
async function fetchIndexHistory(timespan: Timespan) {
  const response = await fetch(`/api/index/history?timespan=${timespan}`);
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: "Unknown error" }));
    
    if (response.status === 429 || error.error?.includes("rate limit")) {
      throw new Error(
        "API rate limit exceeded. Please wait a moment and try again."
      );
    }
    
    throw new Error(`Index API error: ${error.error || response.statusText}`);
  }
  
  return await response.json();
}

export function BTCChart() {
  const [timespan, setTimespan] = useState<Timespan>("1Y");

  // Use React Query to fetch both APIs in parallel with caching
  const results = useQueries({
    queries: [
      {
        queryKey: ["bitcoin-history", timespan],
        queryFn: () => fetchBitcoinHistory(timespan),
        staleTime: 5 * 60 * 1000, // 5 minutes
        gcTime: 10 * 60 * 1000, // 10 minutes
        retry: 2,
      },
      {
        queryKey: ["index-history", timespan],
        queryFn: () => fetchIndexHistory(timespan),
        staleTime: 5 * 60 * 1000, // 5 minutes
        gcTime: 10 * 60 * 1000, // 10 minutes
        retry: 2,
      },
    ],
  });

  const [btcQuery, indexQuery] = results;
  const loading = btcQuery.isLoading || indexQuery.isLoading;
  const error = btcQuery.error || indexQuery.error;

  // Merge the data
  let chartData: ChartData | null = null;
  
  if (btcQuery.data && !btcQuery.isError) {
    const btcData = btcQuery.data;
    const indexData = indexQuery.data;
    
    if (indexData && !indexData.data) {
      console.warn("No index data available, showing only BTC price");
    }

    // Merge the data by timestamp - use a more flexible matching approach
    const mergedData: ChartDataPoint[] = [];
    const indexMap = new Map<number, { index: number; timestamp: number }>();

    // Create a map of index values by timestamp
    if (indexData?.data && indexData.data.length > 0) {
      indexData.data.forEach((point: ChartDataPoint) => {
        // Only store if index is a valid number
        if (typeof point.index === 'number' && !isNaN(point.index) && isFinite(point.index)) {
          indexMap.set(point.timestamp, {
            index: point.index,
            timestamp: point.timestamp,
          });
        }
      });
    }

    // Merge BTC price data with index data
    btcData.data.forEach(
      (btcPoint: { timestamp: number; date: string; price: number }) => {
        // Find the closest index value (within 24 hours)
        let matchedIndex: number | null = null;
        const btcTimestamp = btcPoint.timestamp;

        // Try exact match first
        const exactMatch = indexMap.get(btcTimestamp);
        if (exactMatch) {
          matchedIndex = exactMatch.index;
        } else {
          // Find closest match within 24 hours
          let closestDiff = Infinity;
          let closestIndex: number | null = null;

          for (const [indexTimestamp, indexData] of indexMap.entries()) {
            const diff = Math.abs(btcTimestamp - indexTimestamp);
            // Within 24 hours (86400000 ms)
            if (diff < 86400000 && diff < closestDiff) {
              closestDiff = diff;
              closestIndex = indexData.index;
            }
          }

          matchedIndex = closestIndex;
        }

         // Always include BTC price
         // Only use default 50 if we truly have no index data at all
         // Otherwise, if we have some index data but not for this point, skip it
         if (indexMap.size > 0 && matchedIndex === null) {
           // We have index data but not for this point - skip to avoid showing flat line at 50
           return;
         }
         
         // Only add if we have a valid index or no index data exists at all
         const finalIndex = matchedIndex ?? (indexMap.size === 0 ? 50 : null);
         if (finalIndex === null) {
           return; // Skip this point if we have index data but not for this timestamp
         }
         
         mergedData.push({
           timestamp: btcPoint.timestamp,
           date: btcPoint.date,
           price: btcPoint.price,
           index: finalIndex,
         });
      }
    );

    // Sort by timestamp
    mergedData.sort((a, b) => a.timestamp - b.timestamp);

    if (mergedData.length > 0) {
      chartData = {
        data: mergedData,
        timespan,
        count: mergedData.length,
      };
    }
  }

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    if (timespan === "1D" || timespan === "7D") {
      return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
      });
    } else if (timespan === "30D" || timespan === "90D") {
      return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });
    } else {
      return date.toLocaleDateString("en-US", {
        month: "short",
        year: "numeric",
      });
    }
  };

  const formatPrice = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatIndex = (value: number) => {
    return value.toFixed(1);
  };

  const timespans: { value: Timespan; label: string }[] = [
    { value: "1D", label: "1 Day" },
    { value: "7D", label: "7 Days" },
    { value: "30D", label: "30 Days" },
    { value: "90D", label: "90 Days" },
    { value: "1Y", label: "1 Year" },
    { value: "ALL", label: "All Time" },
  ];

  if (loading && !chartData) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-32 mt-2" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-96 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error && !chartData) {
    const errorMessage = error instanceof Error ? error.message : "Failed to load chart data";
    const isRateLimit = errorMessage.includes("rate limit");
    
    return (
      <Card className="border-destructive">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-destructive" />
            Error Loading Chart
          </CardTitle>
          <CardDescription className="space-y-2">
            <p>{errorMessage}</p>
            {isRateLimit && (
              <div className="mt-2 p-3 bg-muted rounded-md text-sm">
                <p className="font-semibold mb-1">Rate Limit Tips:</p>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                  <li>CoinGecko free API has rate limits (10-50 calls/minute)</li>
                  <li>Try using shorter timespans (1D, 7D, 30D) instead of ALL</li>
                  <li>Wait 30-60 seconds before retrying</li>
                  <li>Consider getting a CoinGecko API key for higher limits</li>
                </ul>
              </div>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <button
            onClick={() => {
              btcQuery.refetch();
              indexQuery.refetch();
            }}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
          >
            Retry
          </button>
          {isRateLimit && (
            <p className="text-xs text-muted-foreground">
              Waiting a moment before retrying may help avoid rate limits.
            </p>
          )}
        </CardContent>
      </Card>
    );
  }

  if (!chartData || chartData.data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Bitcoin Price & Direction Index</CardTitle>
          <CardDescription>No data available</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  // Prepare data for chart (need to scale index to be visible with price)
  // We'll use a dual Y-axis approach
  // Filter out any invalid data points
  const chartDataFormatted = chartData.data
    .filter((point) => {
      // Ensure valid price
      if (point.price <= 0 || !isFinite(point.price)) return false;
      // If index is null/undefined, we might still want to show price only
      // But for now, let's filter out points without valid index if we have index data
      return true;
    })
    .map((point) => ({
      ...point,
      dateLabel: formatDate(point.timestamp),
      // Ensure index is a valid number, or use null if not available
      index:
        typeof point.index === "number" && !isNaN(point.index) && isFinite(point.index)
          ? point.index
          : null,
    }))
    .filter((point) => point.index !== null); // Only show points with valid index

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Bitcoin Price & Direction Index</CardTitle>
            <CardDescription>
              Compare BTC price with the Direction Index over time (
              {chartData.count} data points)
            </CardDescription>
          </div>
          <div className="flex gap-2">
            {timespans.map((ts) => (
              <button
                key={ts.value}
                onClick={() => setTimespan(ts.value)}
                className={`px-3 py-1 rounded-md text-sm font-medium transition-all duration-200 cursor-pointer ${
                  timespan === ts.value
                    ? "bg-primary text-primary-foreground shadow-md scale-105"
                    : "bg-secondary text-secondary-foreground hover:bg-secondary/80 hover:scale-105"
                }`}
              >
                {ts.label}
              </button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={500}>
          <LineChart
            key={timespan}
            data={chartDataFormatted}
            margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis
              dataKey="dateLabel"
              className="text-xs"
              tick={{ fill: "currentColor" }}
              angle={-45}
              textAnchor="end"
              height={80}
            />
            <YAxis
              yAxisId="price"
              orientation="left"
              tick={{ fill: "currentColor" }}
              tickFormatter={formatPrice}
              className="text-xs"
            />
            <YAxis
              yAxisId="index"
              orientation="right"
              tick={{ fill: "currentColor" }}
              domain={[0, 100]}
              className="text-xs"
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "0.5rem",
              }}
              formatter={(
                value: number | undefined,
                name: string | undefined
              ) => {
                if (value === undefined) return "";
                if (name === "price") {
                  return formatPrice(value);
                }
                return formatIndex(value);
              }}
              labelFormatter={(label) => `Date: ${label}`}
            />
            <Legend />
            <Line
              yAxisId="price"
              type="monotone"
              dataKey="price"
              stroke="hsl(var(--primary))"
              strokeWidth={2}
              dot={false}
              name="BTC Price (USD)"
              activeDot={{ r: 4 }}
            />
            <Line
              yAxisId="index"
              type="monotone"
              dataKey="index"
              stroke="hsl(142, 76%, 36%)"
              strokeWidth={2}
              dot={false}
              name="Direction Index (0-100)"
              activeDot={{ r: 4 }}
              connectNulls={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
