import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import type { Pool } from "pg";
import type { AppLoggerPort } from "@/application/ports/AppLoggerPort";

export class PgMigrationRunner {
	public constructor(
		private readonly pool: Pool,
		private readonly logger: AppLoggerPort,
	) {}

	public async run(migrationsDirectory: string): Promise<void> {
		await this.ensureSchemaMigrationsTable();

		const migrationFiles = await this.getMigrationFiles(migrationsDirectory);
		const appliedMigrations = await this.getAppliedMigrationSet();

		for (const migrationFile of migrationFiles) {
			if (appliedMigrations.has(migrationFile)) {
				continue;
			}

			const migrationSql = await readFile(join(migrationsDirectory, migrationFile), "utf-8");
			await this.applySingleMigration(migrationFile, migrationSql);
		}
	}

	private async ensureSchemaMigrationsTable(): Promise<void> {
		await this.pool.query(`
			CREATE TABLE IF NOT EXISTS schema_migrations (
				name TEXT PRIMARY KEY,
				executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
			)
		`);
	}

	private async getMigrationFiles(migrationsDirectory: string): Promise<string[]> {
		const entries = await readdir(migrationsDirectory, { withFileTypes: true });
		return entries
			.filter((entry) => entry.isFile() && entry.name.endsWith(".sql"))
			.map((entry) => entry.name)
			.sort((left, right) => left.localeCompare(right));
	}

	private async getAppliedMigrationSet(): Promise<Set<string>> {
		const result = await this.pool.query<{ name: string }>("SELECT name FROM schema_migrations");
		return new Set(result.rows.map((row) => row.name));
	}

	private async applySingleMigration(name: string, sql: string): Promise<void> {
		const client = await this.pool.connect();
		try {
			await client.query("BEGIN");
			await client.query(sql);
			await client.query("INSERT INTO schema_migrations (name) VALUES ($1)", [name]);
			await client.query("COMMIT");
			this.logger.info("Applied migration", { name });
		} catch (error) {
			await client.query("ROLLBACK");
			this.logger.error("Migration failed", { name, error });
			throw error;
		} finally {
			client.release();
		}
	}
}
