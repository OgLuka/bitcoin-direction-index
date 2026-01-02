import { NextResponse } from "next/server";
import axios from "axios";
import { calculateBitcoinDirectionIndex } from "@/lib/index-calculation";
import { LiquidityData, ISMPMIData, BitcoinPrice } from "@/lib/types";

const FRED_API_KEY = process.env.FRED_API_KEY || "demo";

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
      return 365 * 15;
    default:
      return 365;
  }
}

async function fetchFREDSeries(seriesId: string, limit: number = 365) {
  try {
    const response = await axios.get(
      "https://api.stlouisfed.org/fred/series/observations",
      {
        params: {
          series_id: seriesId,
          api_key: FRED_API_KEY,
          file_type: "json",
          limit: limit,
          sort_order: "desc",
        },
      }
    );

    return response.data.observations
      .filter((obs: { date: string; value: string }) => obs.value !== ".")
      .map((obs: { date: string; value: string }) => ({
        date: obs.date,
        value: parseFloat(obs.value),
      }))
      .reverse();
  } catch (error) {
    console.error(`Error fetching ${seriesId}:`, error);
    return [];
  }
}

async function fetchBitcoinPriceHistory(days: number, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await axios.get(
        `https://api.coingecko.com/api/v3/coins/bitcoin/market_chart`,
        {
          params: {
            vs_currency: "usd",
            days: days === 365 * 15 ? "max" : days,
            interval: days <= 90 ? "hourly" : "daily",
          },
          timeout: 30000,
        }
      );

      return response.data.prices.map(
        ([timestamp, price]: [number, number]) => ({
          timestamp,
          date: new Date(timestamp).toISOString().split("T")[0],
          price,
        })
      );
    } catch (error) {
      if (attempt === maxRetries) {
        console.error("Error fetching Bitcoin price history:", error);
        return [];
      }
      // Wait before retrying
      await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
      console.log(`Retry attempt ${attempt + 1} for Bitcoin price history`);
    }
  }
  return [];
}

async function fetchPMIHistory(limit: number) {
  try {
    const response = await axios.get(
      "https://api.stlouisfed.org/fred/series/observations",
      {
        params: {
          series_id: "NAPM",
          api_key: FRED_API_KEY,
          file_type: "json",
          limit: limit,
          sort_order: "desc",
        },
      }
    );

    const observations = response.data.observations
      .filter((obs: { date: string; value: string }) => obs.value !== ".")
      .map((obs: { date: string; value: string }) => ({
        date: obs.date,
        value: parseFloat(obs.value),
      }))
      .reverse();

    return observations;
  } catch (error) {
    console.error("Error fetching PMI history:", error);
    return [];
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const timespan = (searchParams.get("timespan") || "1Y") as Timespan;
    const days = getDaysFromTimespan(timespan);

    // Fetch historical data
    const [fedData, tgaData, rrpData, btcPriceHistory, pmiHistory] =
      await Promise.all([
        fetchFREDSeries("WALCL", Math.min(days, 365 * 5)), // FRED has limited history
        fetchFREDSeries("WTREGEN", Math.min(days, 365 * 5)),
        fetchFREDSeries("RRPONTSYD", Math.min(days, 365 * 5)),
        fetchBitcoinPriceHistory(days),
        fetchPMIHistory(Math.min(days, 365 * 2)), // PMI is monthly, so we need less data points
      ]);

    // Calculate historical index values
    // We'll calculate for each day where we have all the data
    const indexHistory: Array<{
      timestamp: number;
      date: string;
      index: number;
      price: number;
    }> = [];

    // Create a map of dates to liquidity values
    const liquidityMap = new Map<string, number>();
    fedData.forEach((fed: { date: string; value: number }) => {
      const tgaVal =
        tgaData.find(
          (t: { date: string; value: number }) => t.date === fed.date
        )?.value || 0;
      const rrpVal =
        rrpData.find(
          (r: { date: string; value: number }) => r.date === fed.date
        )?.value || 0;
      liquidityMap.set(fed.date, fed.value - tgaVal - rrpVal);
    });

    // Create a map of dates to PMI values (interpolate monthly PMI to daily)
    const pmiMap = new Map<string, number>();
    pmiHistory.forEach((pmi: { date: string; value: number }) => {
      // Use the same PMI value for the entire month
      const monthStart = pmi.date;
      pmiMap.set(monthStart, pmi.value);
    });

    // Calculate liquidity history for z-score calculation
    const liquidityHistory = Array.from(liquidityMap.values());
    const pmiHistoryValues = pmiHistory.map(
      (p: { date: string; value: number }) => p.value
    );

    // Validate we have enough data
    if (liquidityHistory.length === 0) {
      console.warn("No liquidity history data available");
      return NextResponse.json({
        data: [],
        timespan,
        count: 0,
        error: "Insufficient liquidity data",
      });
    }

    if (pmiHistoryValues.length === 0) {
      console.warn("No PMI history data available");
    }

    // Convert maps to sorted arrays for efficient date matching
    const liquidityEntries = Array.from(liquidityMap.entries()).sort((a, b) =>
      a[0].localeCompare(b[0])
    );
    const pmiEntries = Array.from(pmiMap.entries()).sort((a, b) =>
      a[0].localeCompare(b[0])
    );

    // For each Bitcoin price point, calculate the index
    for (const btcPoint of btcPriceHistory) {
      const dateStr = btcPoint.date;

      // Find closest liquidity data (most recent date <= dateStr)
      let liquidity = 0;
      let liquidityDate = "";

      // Binary search would be better, but linear is fine for now
      for (let i = liquidityEntries.length - 1; i >= 0; i--) {
        const [date, value] = liquidityEntries[i];
        if (date <= dateStr) {
          liquidity = value;
          liquidityDate = date;
          break;
        }
      }

      // Find closest PMI data (most recent date <= dateStr)
      let pmiValue = 50; // Default neutral
      for (let i = pmiEntries.length - 1; i >= 0; i--) {
        const [date, value] = pmiEntries[i];
        if (date <= dateStr) {
          pmiValue = value;
          break;
        }
      }

      // Get recent prices for trend calculation (last 30 points)
      const recentPrices = btcPriceHistory
        .filter(
          (p: { timestamp: number; date: string; price: number }) =>
            p.timestamp <= btcPoint.timestamp
        )
        .slice(-30)
        .map(
          (p: { timestamp: number; date: string; price: number }) => p.price
        );

      // Skip if we don't have enough data
      // But allow calculation even with limited data - we'll handle it in the calculation function
      if (recentPrices.length < 2) {
        continue; // Need at least 2 prices for trend calculation
      }

      // If liquidity is 0, it might be valid (rare but possible), so we'll still try to calculate
      // But if we don't have a liquidity date, skip
      if (!liquidityDate) {
        continue;
      }

      const liquidityData: LiquidityData = {
        fedBalanceSheet:
          fedData.find(
            (f: { date: string; value: number }) => f.date === liquidityDate
          )?.value || 0,
        tga:
          tgaData.find(
            (t: { date: string; value: number }) => t.date === liquidityDate
          )?.value || 0,
        rrp:
          rrpData.find(
            (r: { date: string; value: number }) => r.date === liquidityDate
          )?.value || 0,
        liquidity,
        date: liquidityDate,
      };

      const pmiData: ISMPMIData = {
        value: pmiValue,
        date: dateStr,
      };

      const btcPrice: BitcoinPrice = {
        price: btcPoint.price,
        timestamp: btcPoint.timestamp,
      };

      try {
        const directionIndex = calculateBitcoinDirectionIndex(
          liquidityData,
          liquidityHistory,
          pmiData,
          pmiHistoryValues,
          btcPrice,
          recentPrices
        );

        indexHistory.push({
          timestamp: btcPoint.timestamp,
          date: dateStr,
          index: directionIndex.index,
          price: btcPoint.price,
        });
      } catch (calcError) {
        // Skip if calculation fails
        console.warn(`Failed to calculate index for ${dateStr}:`, calcError);
        continue;
      }
    }

    return NextResponse.json({
      data: indexHistory,
      timespan,
      count: indexHistory.length,
    });
  } catch (error: unknown) {
    console.error("Error in index history API:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Failed to fetch index history";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
