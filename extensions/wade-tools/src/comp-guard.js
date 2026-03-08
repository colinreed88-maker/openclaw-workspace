const COMP_COLUMN_PATTERNS = [
    "compensation", "salary", "hourly", "wage", "pay_rate", "base_pay",
    "total_pay", "annual_comp", "annual base comp",
];
function isCompColumn(key) {
    const lower = key.toLowerCase();
    return COMP_COLUMN_PATTERNS.some((p) => lower.includes(p));
}
export function stripCompColumns(jsonResult) {
    try {
        const parsed = JSON.parse(jsonResult);
        if (parsed.rows && Array.isArray(parsed.rows)) {
            for (const row of parsed.rows) {
                for (const key of Object.keys(row)) {
                    if (isCompColumn(key))
                        delete row[key];
                }
            }
            parsed._comp_redacted = true;
        }
        return JSON.stringify(parsed);
    }
    catch {
        return jsonResult;
    }
}
//# sourceMappingURL=comp-guard.js.map