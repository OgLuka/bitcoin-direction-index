import { NextResponse } from "next/server";
import axios from "axios";

interface CoinGeckoMarketData {
  prices: number[][]; // [timestamp, price]
  market_caps: number[][];
  total_volumes: number[][];
}

type Timespan = "1D" | "7D" | "30D" | "90D" | "1Y" | "ALL";

function getDaysFromTimespan(timespan: Timespan): number {
  switch (timespan) {
    case "1D":
      return 1;
    case "7D":
      return 7;
    case "30D":
      return 30;
    case "90D":
      return 90;
    case "1Y":
      return 365;
    case "ALL":
      return 365 * 15; // ~15 years (Bitcoin started in 2009)
    default:
      return 365;
  }
}

async function fetchWithRetry(
  url: string,
  params: Record<string, any>,
  maxRetries = 3
): Promise<CoinGeckoMarketData> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await axios.get<CoinGeckoMarketData>(url, {
        params,
        timeout: 30000, // 30 second timeout
      });
      return response.data;
    } catch (error: any) {
      // Check if it's a rate limit error (429)
      if (error.response?.status === 429) {
        // For rate limits, wait longer before retrying
        if (attempt < maxRetries) {
          const waitTime = 5000 * attempt; // 5s, 10s, 15s
          console.log(
            `Rate limit hit, waiting ${waitTime}ms before retry ${attempt + 1}`
          );
          await new Promise((resolve) => setTimeout(resolve, waitTime));
          continue;
        } else {
          throw new Error(
            "API rate limit exceeded. Please try again in a moment."
          );
        }
      }

      if (attempt === maxRetries) {
        throw error;
      }
      // Wait before retrying (exponential backoff)
      await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
      console.log(`Retry attempt ${attempt + 1} for Bitcoin history API`);
    }
  }
  throw new Error("Max retries exceeded");
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const timespan = (searchParams.get("timespan") || "1Y") as Timespan;
    const days = getDaysFromTimespan(timespan);

    // Use CoinGecko API for historical data (free, goes back to Bitcoin creation)
    const marketData = await fetchWithRetry(
      `https://api.coingecko.com/api/v3/coins/bitcoin/market_chart`,
      {
        vs_currency: "usd",
        days: days === 365 * 15 ? "max" : days, // 'max' for all historical data
        interval: days <= 90 ? "hourly" : "daily", // Use hourly for short periods, daily for longer
      }
    );

    // Transform data to our format
    const data = marketData.prices.map(([timestamp, price]) => ({
      timestamp,
      date: new Date(timestamp).toISOString(),
      price,
    }));

    if (data.length === 0) {
      return NextResponse.json(
        { error: "No Bitcoin price data returned from API" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      data,
      timespan,
      count: data.length,
    });
  } catch (error: unknown) {
    console.error("Error fetching Bitcoin history:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";

    // Check if it's a rate limit error
    if (errorMessage.includes("429") || errorMessage.includes("rate limit")) {
      return NextResponse.json(
        { error: "API rate limit exceeded. Please try again in a moment." },
        { status: 429 }
      );
    }

    return NextResponse.json(
      { error: `Failed to fetch Bitcoin historical data: ${errorMessage}` },
      { status: 500 }
    );
  }
}
