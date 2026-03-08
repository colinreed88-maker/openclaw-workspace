export declare function resolveBudgetDeptToSageDepts(budgetDept: string): Promise<string[]>;
export declare function resolveDeptNamesToIds(deptNames: string[]): Promise<string[]>;
export declare function loadDeptIdToName(): Promise<Map<string, string>>;
export declare function loadAccountNoToTitle(): Promise<Map<string, string>>;
export interface FsMappingEntry {
    subtotal_line: string;
    is_pl: boolean;
}
export declare function loadFsMapping(): Promise<Map<string, FsMappingEntry>>;
/** Maps Sage department names -> budget BU */
export declare function loadBuMapping(): Promise<Map<string, string>>;
/** Maps Sage department IDs (D300, D301...) -> budget BU */
export declare function loadBuMappingByDeptId(): Promise<Map<string, string>>;
