import type { Pool } from "pg";
import type { AppLoggerPort } from "@/application/ports/AppLoggerPort";

interface RequiredTableRow {
	schemaMigrations: string | null;
	sshEvents: string | null;
}

export class PgHoneypotReadinessGuard {
	public constructor(
		private readonly pool: Pool,
		private readonly logger: AppLoggerPort
	) {}

	public async ensureReady(): Promise<void> {
		const result = await this.pool.query<RequiredTableRow>(`
			SELECT
				to_regclass('public.schema_migrations') AS "schemaMigrations",
				to_regclass('public.ssh_events') AS "sshEvents"
		`);

		const row = result.rows[0];
		const missingTables: string[] = [];

		if (!row?.schemaMigrations) {
			missingTables.push("schema_migrations");
		}

		if (!row?.sshEvents) {
			missingTables.push("ssh_events");
		}

		if (missingTables.length === 0) {
			this.logger.info("PostgreSQL schema readiness check passed");
			return;
		}

		throw new Error(
			`Missing PostgreSQL tables (${missingTables.join(", ")}). Run 'pnpm migrate' before starting with EVENT_STORE=pg.`
		);
	}
}
