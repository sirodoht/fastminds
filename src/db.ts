import { Database } from "bun:sqlite";

const dbPath =
  process.env.DATABASE_URL?.replace("sqlite://", "") || "fastminds.db";
export const sqlite = new Database(dbPath);

sqlite.exec("PRAGMA foreign_keys = ON;");

const BOOLEAN_FIELDS = new Set([
  "email_verified",
  "payment_verified",
  "is_admin",
  "is_mine",
  "is_bookmarked",
  "initiator_sent",
  "recipient_sent",
  "hidden",
  "revealed",
]);

function normalizeRow(row: any): any {
  if (!row || typeof row !== "object") return row;
  for (const [key, value] of Object.entries(row)) {
    if (BOOLEAN_FIELDS.has(key) && (value === 0 || value === 1)) {
      row[key] = Boolean(value);
    }
  }
  return row;
}

function runTemplate(
  strings: TemplateStringsArray,
  values: any[]
): Promise<any[]> {
  let sql = "";
  const params: any[] = [];

  for (let i = 0; i < strings.length; i++) {
    sql += strings[i];
    if (i < values.length) {
      const val = values[i];
      if (val && val._db_array) {
        sql += "(" + val.values.map(() => "?").join(",") + ")";
        params.push(...val.values);
      } else if (Array.isArray(val)) {
        sql += "(" + val.map(() => "?").join(",") + ")";
        params.push(...val);
      } else {
        sql += "?";
        params.push(val);
      }
    }
  }

  const lower = sql.trim().toLowerCase();
  const isSelect = lower.startsWith("select") || lower.startsWith("with");
  const hasReturning = lower.includes("returning");

  return new Promise((resolve, reject) => {
    try {
      if (isSelect || hasReturning) {
        const stmt = sqlite.query(sql);
        const rows = stmt.all(...params).map(normalizeRow);
        stmt.finalize();
        resolve(rows);
      } else {
        const stmt = sqlite.query(sql);
        const result = stmt.run(...params);
        stmt.finalize();
        resolve({ count: result.changes } as any);
      }
    } catch (err) {
      reject(err);
    }
  });
}

export const db = Object.assign(
  function (stringsOrValues: any, ...values: any[]) {
    if (stringsOrValues && stringsOrValues.raw) {
      return runTemplate(stringsOrValues, values);
    }
    // Called as db(freshPosts) for array expansion
    return { _db_array: true, values: stringsOrValues };
  },
  { sqlite }
);

export function generateUUID(): string {
  return crypto.randomUUID();
}
