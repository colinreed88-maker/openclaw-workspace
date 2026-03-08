import { getSupabase } from "./db.js";
import { cachedLoad } from "./cache.js";
async function loadBuMappingRows() {
    return cachedLoad("bu_mapping_rows", async () => {
        const supabase = getSupabase();
        const { data } = await supabase
            .from("dim_bu_mapping")
            .select("source_identifier, budget_bu, budget_department, forecast_department")
            .eq("is_active", true)
            .eq("source_system", "sage");
        return (data ?? []);
    });
}
// ── Public functions ──
export async function resolveBudgetDeptToSageDepts(budgetDept) {
    const rows = await loadBuMappingRows();
    const lower = budgetDept.toLowerCase();
    const sageDepts = [];
    for (const row of rows) {
        const fd = (row.forecast_department ?? "").toLowerCase();
        const bd = (row.budget_department ?? "").toLowerCase();
        const bu = (row.budget_bu ?? "").toLowerCase();
        if (fd === lower || bd === lower || bu === lower) {
            sageDepts.push(row.source_identifier);
        }
    }
    return sageDepts;
}
export async function resolveDeptNamesToIds(deptNames) {
    const deptMap = await loadDeptIdToName();
    const ids = [];
    for (const [id, name] of deptMap) {
        if (deptNames.includes(name))
            ids.push(id);
    }
    return ids;
}
export async function loadDeptIdToName() {
    return cachedLoad("dept_id_to_name", async () => {
        const supabase = getSupabase();
        const { data } = await supabase
            .from("intacct_departments")
            .select("department_id, title");
        const map = new Map();
        for (const d of (data ?? [])) {
            map.set(d.department_id, d.title);
        }
        return map;
    });
}
export async function loadAccountNoToTitle() {
    return cachedLoad("account_no_to_title", async () => {
        const supabase = getSupabase();
        const { data } = await supabase
            .from("intacct_accounts")
            .select("account_no, title");
        const map = new Map();
        for (const r of (data ?? [])) {
            if (r.title)
                map.set(r.account_no, r.title);
        }
        return map;
    });
}
const PL_GRAND_TOTALS = new Set([
    "Total Revenue",
    "Total Operating Expenses",
    "Total Other Income (Expense)",
]);
export async function loadFsMapping() {
    return cachedLoad("fs_mapping", async () => {
        const supabase = getSupabase();
        const { data } = await supabase
            .from("dim_fs_mapping")
            .select("gl_account_number, subtotal_line, grand_total_line")
            .not("subtotal_line", "is", null)
            .limit(5000);
        const map = new Map();
        for (const r of (data ?? [])) {
            if (r.subtotal_line) {
                map.set(String(r.gl_account_number), {
                    subtotal_line: r.subtotal_line,
                    is_pl: PL_GRAND_TOTALS.has(r.grand_total_line ?? ""),
                });
            }
        }
        return map;
    });
}
/** Maps Sage department names -> budget BU */
export async function loadBuMapping() {
    const rows = await loadBuMappingRows();
    const map = new Map();
    for (const row of rows) {
        map.set(row.source_identifier, row.budget_bu);
    }
    return map;
}
/** Maps Sage department IDs (D300, D301...) -> budget BU */
export async function loadBuMappingByDeptId() {
    const [rows, deptMap] = await Promise.all([
        loadBuMappingRows(),
        loadDeptIdToName(),
    ]);
    const nameToId = new Map();
    for (const [id, name] of deptMap) {
        nameToId.set(name, id);
    }
    const map = new Map();
    for (const row of rows) {
        const deptId = nameToId.get(row.source_identifier);
        if (deptId)
            map.set(deptId, row.budget_bu);
    }
    return map;
}
//# sourceMappingURL=bu-mapping.js.map