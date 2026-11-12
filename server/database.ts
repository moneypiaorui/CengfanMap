import { neon } from "@neondatabase/serverless";

export interface SqlStatement {
  text: string;
  values?: unknown[];
}

class DatabaseNotConfiguredError extends Error {
  constructor() {
    super("DATABASE_URL or POSTGRES_URL is required");
    this.name = "DatabaseNotConfiguredError";
  }
}

function getConnectionString() {
  const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!connectionString) throw new DatabaseNotConfiguredError();
  return connectionString;
}

export async function runQueries(
  statements: SqlStatement[],
  options: {
    readOnly?: boolean;
    isolationLevel?: "ReadCommitted" | "RepeatableRead";
    timeoutMs?: number;
  } = {},
): Promise<Record<string, unknown>[][]> {
  const sql = neon(getConnectionString());
  return sql.transaction(
    statements.map((statement) =>
      sql.query(statement.text, statement.values ?? []),
    ),
    {
      readOnly: options.readOnly ?? true,
      isolationLevel: options.isolationLevel ?? "ReadCommitted",
      fetchOptions: { signal: AbortSignal.timeout(options.timeoutMs ?? 8000) },
    },
  );
}
