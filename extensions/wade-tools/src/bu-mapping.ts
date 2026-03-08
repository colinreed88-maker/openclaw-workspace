import { getSupabase } from "./db.js";
import { cachedLoad } from "./cache.js";

// ── dim_bu_mapping row type ──

interface BuMappingRow {
  source_identifier: string;
  budget_bu: string;
  budget_department: string | null;
  forecast_department: string | null;
}

async function loadBuMappingRows(): Promise<BuMappingRow[]> {
  return cachedLoad("bu_mapping_rows", async () => {
    const supabase = getSupabase();
    const { data } = await supabase
      .from("dim_bu_mapping")
      .select("source_identifier, budget_bu, budget_department, forecast_department")
      .eq("is_active", true)
      .eq("source_system", "sage");
    return (data ?? []) as BuMappingRow[];
  });
}

// ── Public functions ──

export async function resolveBudgetDeptToSageDepts(budgetDept: string): Promise<string[]> {
  const rows = await loadBuMappingRows();
  const lower = budgetDept.toLowerCase();
  const sageDepts: string[] = [];

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

export async function resolveDeptNamesToIds(deptNames: string[]): Promise<string[]> {
  const deptMap = await loadDeptIdToName();
  const ids: string[] = [];
  for (const [id, name] of deptMap) {
    if (deptNames.includes(name)) ids.push(id);
  }
  return ids;
}

export async function loadDeptIdToName(): Promise<Map<string, string>> {
  return cachedLoad("dept_id_to_name", async () => {
    const supabase = getSupabase();
    const { data } = await supabase
      .from("intacct_departments")
      .select("department_id, title");
    const map = new Map<string, string>();
    for (const d of (data ?? []) as { department_id: string; title: string }[]) {
      map.set(d.department_id, d.title);
    }
    return map;
  });
}

export async function loadAccountNoToTitle(): Promise<Map<string, string>> {
  return cachedLoad("account_no_to_title", async () => {
    const supabase = getSupabase();
    const { data } = await supabase
      .from("intacct_accounts")
      .select("account_no, title");
    const map = new Map<string, string>();
    for (const r of (data ?? []) as { account_no: string; title: string | null }[]) {
      if (r.title) map.set(r.account_no, r.title);
    }
    return map;
  });
}

const PL_GRAND_TOTALS = new Set([
  "Total Revenue",
  "Total Operating Expenses",
  "Total Other Income (Expense)",
]);

export interface FsMappingEntry { subtotal_line: string; is_pl: boolean }

export async function loadFsMapping(): Promise<Map<string, FsMappingEntry>> {
  return cachedLoad("fs_mapping", async () => {
    const supabase = getSupabase();
    const { data } = await supabase
      .from("dim_fs_mapping")
      .select("gl_account_number, subtotal_line, grand_total_line")
      .not("subtotal_line", "is", null)
      .limit(5000);
    const map = new Map<string, FsMappingEntry>();
    for (const r of (data ?? []) as { gl_account_number: string; subtotal_line: string | null; grand_total_line: string | null }[]) {
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
export async function loadBuMapping(): Promise<Map<string, string>> {
  const rows = await loadBuMappingRows();
  const map = new Map<string, string>();
  for (const row of rows) {
    map.set(row.source_identifier, row.budget_bu);
  }
  return map;
}

/** Maps Sage department IDs (D300, D301...) -> budget BU */
export async function loadBuMappingByDeptId(): Promise<Map<string, string>> {
  const [rows, deptMap] = await Promise.all([
    loadBuMappingRows(),
    loadDeptIdToName(),
  ]);

  const nameToId = new Map<string, string>();
  for (const [id, name] of deptMap) {
    nameToId.set(name, id);
  }

  const map = new Map<string, string>();
  for (const row of rows) {
    const deptId = nameToId.get(row.source_identifier);
    if (deptId) map.set(deptId, row.budget_bu);
  }
  return map;
}
