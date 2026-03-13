import snowflake from "snowflake-sdk";
snowflake.configure({ logLevel: "WARN" });
let conn = null;
let connecting = null;
function getConfig() {
    const account = process.env.SNOWFLAKE_ACCOUNT;
    const username = process.env.SNOWFLAKE_USERNAME;
    const password = process.env.SNOWFLAKE_PASSWORD;
    const warehouse = process.env.SNOWFLAKE_WAREHOUSE;
    if (!account || !username || !password || !warehouse) {
        throw new Error("Missing Snowflake env vars: SNOWFLAKE_ACCOUNT, SNOWFLAKE_USERNAME, SNOWFLAKE_PASSWORD, SNOWFLAKE_WAREHOUSE");
    }
    return {
        account,
        username,
        password,
        warehouse,
        database: process.env.SNOWFLAKE_DATABASE ?? "ANALYTICS",
        application: "WadeAgent",
    };
}
function isConnected() {
    return conn !== null && conn.isUp();
}
async function getConnection() {
    if (isConnected())
        return conn;
    if (connecting)
        return connecting;
    connecting = new Promise((resolve, reject) => {
        const c = snowflake.createConnection(getConfig());
        c.connect((err, connection) => {
            connecting = null;
            if (err) {
                conn = null;
                reject(new Error(`Snowflake connection failed: ${err.message}`));
            }
            else {
                conn = connection;
                resolve(connection);
            }
        });
    });
    return connecting;
}
/**
 * Execute a read-only SQL query against Snowflake.
 * Uses a persistent singleton connection with auto-reconnect.
 */
export async function querySnowflake(sql, binds, opts) {
    const connection = await getConnection();
    const timeout = opts?.timeout ?? 30_000;
    return new Promise((resolve, reject) => {
        connection.execute({
            sqlText: sql,
            binds: binds,
            streamResult: false,
            parameters: {
                QUERY_TAG: "wade-agent",
                STATEMENT_TIMEOUT_IN_SECONDS: Math.ceil(timeout / 1000),
            },
            complete: (err, _stmt, rows) => {
                if (err) {
                    // If connection dropped, clear it so next call reconnects
                    if (err.message?.includes("not connected") || err.message?.includes("connection")) {
                        conn = null;
                    }
                    reject(new Error(`Snowflake query failed: ${err.message}`));
                    return;
                }
                const typedRows = (rows ?? []);
                const columns = typedRows.length > 0 ? Object.keys(typedRows[0]) : [];
                resolve({
                    rows: typedRows,
                    columns,
                    totalRows: typedRows.length,
                });
            },
        });
    });
}
//# sourceMappingURL=snowflake.js.map