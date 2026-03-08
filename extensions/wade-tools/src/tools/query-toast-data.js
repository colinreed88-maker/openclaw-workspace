import { getSupabase } from "../db.js";
import { textResult } from "../types.js";
export const definition = {
    name: "query_toast_data",
    description: "Query Toast POS / F&B data directly from structured tables. ALWAYS use this for restaurant revenue, food sales, labor hours, menu item performance, or F&B metrics. Do NOT use query_financial_data for F&B/Toast questions.",
    parameters: {
        type: "object",
        properties: {
            metric: {
                type: "string",
                enum: ["daily_sales", "labor", "top_items", "category_sales", "payment_mix", "orders"],
                description: "What to query. daily_sales = revenue by day, labor = labor hours/cost, top_items = best-selling items, category_sales = by sales category, payment_mix = payment types, orders = individual orders.",
            },
            restaurant_guid: {
                type: "string",
                description: "Filter to specific restaurant location. Omit for all locations.",
            },
            date_from: {
                type: "string",
                description: "Start date (YYYY-MM-DD).",
            },
            date_to: {
                type: "string",
                description: "End date (YYYY-MM-DD).",
            },
            limit: { type: "number", description: "Max rows (default 30)." },
        },
        required: ["metric"],
    },
};
export async function execute(_id, params) {
    const supabase = getSupabase();
    const metric = params.metric;
    const restaurantGuid = params.restaurant_guid;
    const dateFrom = params.date_from;
    const dateTo = params.date_to;
    const limit = params.limit ?? 30;
    if (metric === "daily_sales") {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let q = supabase.from("toast_orders")
            .select("*")
            .order("business_date", { ascending: false })
            .limit(5000);
        if (restaurantGuid)
            q = q.eq("restaurant_guid", restaurantGuid);
        if (dateFrom)
            q = q.gte("business_date", dateFrom);
        if (dateTo)
            q = q.lte("business_date", dateTo);
        const { data, error } = await q;
        if (error)
            return textResult({ error: error.message });
        const rows = (data ?? []);
        const daily = new Map();
        for (const row of rows) {
            const date = row.business_date ?? "unknown";
            const existing = daily.get(date) ?? { date, revenue: 0, orders: 0, guests: 0, tips: 0 };
            existing.revenue += Number(row.total_amount) || 0;
            existing.orders += 1;
            existing.guests += Number(row.guest_count) || 0;
            existing.tips += Number(row.tip_amount) || 0;
            daily.set(date, existing);
        }
        const sorted = Array.from(daily.values())
            .sort((a, b) => b.date.localeCompare(a.date))
            .slice(0, limit)
            .map((r) => ({ ...r, revenue: Math.round(r.revenue * 100) / 100, tips: Math.round(r.tips * 100) / 100 }));
        return textResult({ source: "toast_orders", metric: "daily_sales", row_count: sorted.length, rows: sorted });
    }
    if (metric === "labor") {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let q = supabase.from("toast_time_entries")
            .select("*")
            .order("business_date", { ascending: false })
            .limit(5000);
        if (restaurantGuid)
            q = q.eq("restaurant_guid", restaurantGuid);
        if (dateFrom)
            q = q.gte("business_date", dateFrom);
        if (dateTo)
            q = q.lte("business_date", dateTo);
        const { data, error } = await q;
        if (error)
            return textResult({ error: error.message });
        const rows = (data ?? []);
        const daily = new Map();
        for (const row of rows) {
            const date = row.business_date ?? "unknown";
            const existing = daily.get(date) ?? { date, regular_hours: 0, overtime_hours: 0, labor_cost: 0, entries: 0 };
            const regHrs = Number(row.regular_hours) || 0;
            const otHrs = Number(row.overtime_hours) || 0;
            const wage = Number(row.hourly_wage) || 0;
            existing.regular_hours += regHrs;
            existing.overtime_hours += otHrs;
            existing.labor_cost += (regHrs + otHrs * 1.5) * wage;
            existing.entries += 1;
            daily.set(date, existing);
        }
        const sorted = Array.from(daily.values())
            .sort((a, b) => b.date.localeCompare(a.date))
            .slice(0, limit)
            .map((r) => ({ ...r, regular_hours: Math.round(r.regular_hours * 100) / 100, overtime_hours: Math.round(r.overtime_hours * 100) / 100, labor_cost: Math.round(r.labor_cost * 100) / 100 }));
        return textResult({ source: "toast_time_entries", metric: "labor", row_count: sorted.length, rows: sorted });
    }
    if (metric === "top_items") {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let q = supabase.from("toast_order_items")
            .select("*")
            .eq("voided", false)
            .limit(10000);
        if (restaurantGuid)
            q = q.eq("restaurant_guid", restaurantGuid);
        if (dateFrom)
            q = q.gte("business_date", dateFrom);
        if (dateTo)
            q = q.lte("business_date", dateTo);
        const { data, error } = await q;
        if (error)
            return textResult({ error: error.message });
        const rows = (data ?? []);
        const items = new Map();
        for (const row of rows) {
            const name = row.item_name ?? "(unknown)";
            const existing = items.get(name) ?? { item_name: name, quantity: 0, revenue: 0 };
            existing.quantity += Number(row.quantity) || 0;
            existing.revenue += Number(row.price) || 0;
            items.set(name, existing);
        }
        const sorted = Array.from(items.values())
            .sort((a, b) => b.revenue - a.revenue)
            .slice(0, limit)
            .map((r) => ({ ...r, revenue: Math.round(r.revenue * 100) / 100 }));
        return textResult({ source: "toast_order_items", metric: "top_items", row_count: sorted.length, rows: sorted });
    }
    if (metric === "category_sales") {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let q = supabase.from("toast_order_items")
            .select("*")
            .eq("voided", false)
            .limit(10000);
        if (restaurantGuid)
            q = q.eq("restaurant_guid", restaurantGuid);
        if (dateFrom)
            q = q.gte("business_date", dateFrom);
        if (dateTo)
            q = q.lte("business_date", dateTo);
        const { data, error } = await q;
        if (error)
            return textResult({ error: error.message });
        const rows = (data ?? []);
        const cats = new Map();
        for (const row of rows) {
            const cat = row.sales_category ?? "(uncategorized)";
            const existing = cats.get(cat) ?? { category: cat, quantity: 0, revenue: 0 };
            existing.quantity += Number(row.quantity) || 0;
            existing.revenue += Number(row.price) || 0;
            cats.set(cat, existing);
        }
        const sorted = Array.from(cats.values())
            .sort((a, b) => b.revenue - a.revenue)
            .slice(0, limit)
            .map((r) => ({ ...r, revenue: Math.round(r.revenue * 100) / 100 }));
        return textResult({ source: "toast_order_items", metric: "category_sales", row_count: sorted.length, rows: sorted });
    }
    if (metric === "payment_mix") {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let q = supabase.from("toast_payments")
            .select("*")
            .limit(10000);
        if (restaurantGuid)
            q = q.eq("restaurant_guid", restaurantGuid);
        if (dateFrom)
            q = q.gte("paid_date", dateFrom);
        if (dateTo)
            q = q.lte("paid_date", dateTo);
        const { data, error } = await q;
        if (error)
            return textResult({ error: error.message });
        const rows = (data ?? []);
        const types = new Map();
        for (const row of rows) {
            const ptype = row.payment_type ?? "(unknown)";
            const existing = types.get(ptype) ?? { payment_type: ptype, count: 0, total_amount: 0 };
            existing.count += 1;
            existing.total_amount += Number(row.amount) || 0;
            types.set(ptype, existing);
        }
        const sorted = Array.from(types.values())
            .sort((a, b) => b.total_amount - a.total_amount)
            .map((r) => ({ ...r, total_amount: Math.round(r.total_amount * 100) / 100 }));
        return textResult({ source: "toast_payments", metric: "payment_mix", row_count: sorted.length, rows: sorted });
    }
    if (metric === "orders") {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let q = supabase.from("toast_orders")
            .select("*")
            .order("business_date", { ascending: false })
            .limit(limit);
        if (restaurantGuid)
            q = q.eq("restaurant_guid", restaurantGuid);
        if (dateFrom)
            q = q.gte("business_date", dateFrom);
        if (dateTo)
            q = q.lte("business_date", dateTo);
        const { data, error } = await q;
        if (error)
            return textResult({ error: error.message });
        return textResult({ source: "toast_orders", metric: "orders", row_count: (data ?? []).length, rows: data ?? [] });
    }
    return textResult({ error: `Unknown Toast metric: ${metric}` });
}
//# sourceMappingURL=query-toast-data.js.map