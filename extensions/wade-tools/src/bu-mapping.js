import { getSupabase } from "./db.js";
export const DEPT_ALIASES = {
    engineering: ["tech", "engineering", "product design", "product management"],
    "food and beverage": ["f&b", "food and beverage", "grocer", "commissary"],
    "f&b": ["f&b", "food and beverage", "grocer", "commissary"],
    tech: ["tech", "engineering", "product design", "product management"],
};
export const FPA_DEPT_TO_BU = {
    engineering: "Tech",
    tech: "Tech",
    product: "Tech",
    "food and beverage": "F&B",
    "f&b": "F&B",
    grocer: "F&B",
    commissary: "F&B",
};
export async function resolveBudgetDeptToSageDepts(budgetDept) {
    const supabase = getSupabase();
    const { data } = await supabase
        .from("dim_bu_mapping")
        .select("source_identifier, budget_department, forecast_department, budget_bu")
        .eq("source_system", "sage")
        .eq("is_active", true);
    if (!data)
        return [];
    const lower = budgetDept.toLowerCase();
    const sageDepts = [];
    const aliasTargets = DEPT_ALIASES[lower];
    for (const row of data) {
        const bd = (row.forecast_department ?? row.budget_department ?? "").toLowerCase();
        const bu = (row.budget_bu ?? "").toLowerCase();
        if (aliasTargets) {
            if (aliasTargets.some((a) => bd.includes(a) || bu.includes(a))) {
                sageDepts.push(row.source_identifier);
            }
        }
        else if (bd === lower) {
            sageDepts.push(row.source_identifier);
        }
    }
    return sageDepts;
}
export async function resolveDeptNamesToIds(deptNames) {
    const supabase = getSupabase();
    const { data } = await supabase
        .from("intacct_departments")
        .select("department_id, title")
        .in("title", deptNames);
    if (!data)
        return [];
    return data.map((r) => r.department_id);
}
export async function loadDeptIdToName() {
    const supabase = getSupabase();
    const { data } = await supabase
        .from("intacct_departments")
        .select("department_id, title");
    if (!data)
        return new Map();
    const map = new Map();
    for (const d of data) {
        map.set(d.department_id, d.title);
    }
    return map;
}
export async function loadAccountNoToTitle() {
    const supabase = getSupabase();
    const { data } = await supabase
        .from("intacct_gl_detail")
        .select("account_no, account_title")
        .not("account_title", "is", null)
        .limit(5000);
    if (!data)
        return new Map();
    const map = new Map();
    for (const r of data) {
        if (r.account_title && !map.has(r.account_no)) {
            map.set(r.account_no, r.account_title);
        }
    }
    return map;
}
const PL_GRAND_TOTALS = new Set([
    "Total Revenue",
    "Total Operating Expenses",
    "Total Other Income (Expense)",
]);
export async function loadFsMapping() {
    const supabase = getSupabase();
    const { data } = await supabase
        .from("dim_fs_mapping")
        .select("gl_account_number, subtotal_line, grand_total_line")
        .not("subtotal_line", "is", null)
        .limit(5000);
    if (!data)
        return new Map();
    const map = new Map();
    for (const r of data) {
        if (r.subtotal_line) {
            map.set(String(r.gl_account_number), {
                subtotal_line: r.subtotal_line,
                is_pl: PL_GRAND_TOTALS.has(r.grand_total_line ?? ""),
            });
        }
    }
    return map;
}
/** Maps Sage department names -> budget BU */
export async function loadBuMapping() {
    const supabase = getSupabase();
    const { data } = await supabase
        .from("dim_bu_mapping")
        .select("source_identifier, budget_bu")
        .eq("is_active", true)
        .eq("source_system", "sage");
    const map = new Map();
    for (const row of (data ?? [])) {
        map.set(row.source_identifier, row.budget_bu);
    }
    return map;
}
/** Maps Sage department IDs (D300, D301...) -> budget BU */
export async function loadBuMappingByDeptId() {
    const supabase = getSupabase();
    const { data: mappings } = await supabase
        .from("dim_bu_mapping")
        .select("source_identifier, budget_bu")
        .eq("is_active", true)
        .eq("source_system", "sage");
    const { data: departments } = await supabase
        .from("intacct_departments")
        .select("department_id, title");
    if (!mappings || !departments)
        return new Map();
    const nameToId = new Map();
    for (const d of departments) {
        nameToId.set(d.title, d.department_id);
    }
    const map = new Map();
    for (const row of mappings) {
        const deptId = nameToId.get(row.source_identifier);
        if (deptId) {
            map.set(deptId, row.budget_bu);
        }
    }
    return map;
}
//# sourceMappingURL=bu-mapping.js.map