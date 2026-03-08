import { getSupabase } from "../db.js";
import { textResult, type ToolResult } from "../types.js";

// Toast location map (from flow-intranet/lib/toast-locations.ts)
const LOCATIONS: Record<string, string> = {
  grocer: "2c0dabcf-3505-4784-af53-06231467397b",
  "flow grocer": "2c0dabcf-3505-4784-af53-06231467397b",
  station: "b2369f42-159d-4fd7-add5-5c1ffe1e09ac",
  "flow station": "b2369f42-159d-4fd7-add5-5c1ffe1e09ac",
  "food truck": "669c4464-eccf-4119-a7cd-137f61b1c7ff",
  "flow food truck": "669c4464-eccf-4119-a7cd-137f61b1c7ff",
  pool: "9b4ec467-171d-4af2-8892-67c7be772f5b",
  "flow pool": "9b4ec467-171d-4af2-8892-67c7be772f5b",
};

const METRIC_TO_RPC: Record<string, string> = {
  daily_sales: "fb_daily_sales",
  labor: "fb_labor_by_day",
  top_items: "fb_top_items",
  category_sales: "fb_category_sales",
  payment_mix: "fb_payment_mix",
  hourly_sales: "fb_hourly_sales",
  server_performance: "fb_server_performance",
  employee_performance: "fb_employee_performance",
  ticket_time: "fb_daily_ticket_time",
  discount_void: "fb_discount_void_daily",
  dining_options: "fb_dining_options",
};

export const definition = {
  name: "query_toast_data",
  description:
    "Query Toast POS / F&B data using the same Postgres RPCs as the Flow Intranet FB Dashboard. Returns aggregated metrics by location and date. Locations: Grocer, Station, Food Truck, Pool.",
  parameters: {
    type: "object",
    properties: {
      metric: {
        type: "string",
        enum: [
          "daily_sales", "labor", "top_items", "category_sales", "payment_mix",
          "hourly_sales", "server_performance", "employee_performance",
          "ticket_time", "discount_void", "dining_options", "orders",
        ],
        description: "daily_sales=revenue by day, labor=labor hours/cost, top_items=best sellers, category_sales=by category, payment_mix=payment types, hourly_sales=by hour, server_performance=by server, employee_performance=by employee, ticket_time=order duration, discount_void=discounts/voids, dining_options=dine-in/takeout, orders=raw individual orders.",
      },
      location: {
        type: "string",
        description: 'Location name: "Grocer", "Station", "Food Truck", "Pool". Omit for all locations.',
      },
      date_from: { type: "string", description: "Start date (YYYY-MM-DD). For RPC metrics, this sets the since_date." },
      date_to: { type: "string", description: "End date (YYYY-MM-DD). Only used for 'orders' metric." },
      limit: { type: "number", description: "Max rows (default 50)." },
    },
    required: ["metric"],
  },
};

export async function execute(_id: string, params: Record<string, unknown>): Promise<ToolResult> {
  const supabase = getSupabase();
  const metric = params.metric as string;
  const locationInput = params.location as string | undefined;
  const dateFrom = params.date_from as string | undefined;
  const dateTo = params.date_to as string | undefined;
  const limit = (params.limit as number) ?? 50;

  // Resolve location name to GUID
  const restaurantGuid = locationInput ? LOCATIONS[locationInput.toLowerCase()] : undefined;
  if (locationInput && !restaurantGuid) {
    return textResult({ error: `Unknown location "${locationInput}". Valid: Grocer, Station, Food Truck, Pool.` });
  }

  // Raw orders mode (not an RPC)
  if (metric === "orders") {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let q = (supabase.from("toast_orders") as any)
      .select("*")
      .order("business_date", { ascending: false })
      .limit(limit);

    if (restaurantGuid) q = q.eq("restaurant_guid", restaurantGuid);
    if (dateFrom) q = q.gte("business_date", dateFrom);
    if (dateTo) q = q.lte("business_date", dateTo);

    const { data, error } = await q;
    if (error) return textResult({ error: error.message });
    return textResult({ source: "toast_orders", metric: "orders", row_count: (data ?? []).length, rows: data ?? [] });
  }

  // RPC mode for all aggregated metrics
  const rpcName = METRIC_TO_RPC[metric];
  if (!rpcName) {
    return textResult({ error: `Unknown metric: ${metric}` });
  }

  // Default since_date: 30 days ago if not provided
  const sinceDate = dateFrom ?? daysAgo(30);

  const { data, error } = await supabase.rpc(rpcName, { since_date: sinceDate });
  if (error) return textResult({ error: `RPC ${rpcName} failed: ${error.message}` });

  let rows = (data ?? []) as Record<string, unknown>[];

  // Filter by location if specified (RPCs return all locations)
  if (restaurantGuid) {
    rows = rows.filter((r) => r.restaurant_guid === restaurantGuid);
  }

  // Apply limit
  rows = rows.slice(0, limit);

  return textResult({
    source: `rpc:${rpcName}`,
    metric,
    location: locationInput ?? "all",
    since_date: sinceDate,
    row_count: rows.length,
    rows,
  });
}

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split("T")[0];
}
