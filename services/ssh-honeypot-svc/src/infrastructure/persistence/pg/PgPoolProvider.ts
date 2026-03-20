import { Pool, type PoolConfig } from "pg";

export class PgPoolProvider {
	private pool: Pool | undefined;

	public constructor(private readonly config: PoolConfig) {}

	public getPool(): Pool {
		if (!this.pool) {
			this.pool = new Pool(this.config);
		}

		return this.pool;
	}

	public async close(): Promise<void> {
		if (!this.pool) {
			return;
		}

		await this.pool.end();
		this.pool = undefined;
	}
}
