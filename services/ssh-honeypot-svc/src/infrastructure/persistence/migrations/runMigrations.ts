import { resolve } from "node:path";
import { env } from "@/common/utils/envConfig";
import { PinoAppLogger } from "@/infrastructure/logging/PinoAppLogger";
import { PgMigrationRunner } from "@/infrastructure/persistence/migrations/PgMigrationRunner";
import { PgPoolProvider } from "@/infrastructure/persistence/pg/PgPoolProvider";

const logger = new PinoAppLogger("ssh-honeypot-migrations");

const main = async (): Promise<void> => {
	const poolProvider = new PgPoolProvider({
		host: env.PG_HOST,
		port: env.PG_PORT,
		user: env.PG_USER,
		password: env.PG_PASSWORD,
		database: env.PG_DATABASE,
	});

	try {
		const runner = new PgMigrationRunner(poolProvider.getPool(), logger);
		const migrationsDirectory = resolve(process.cwd(), "migrations");
		await runner.run(migrationsDirectory);
		logger.info("All migrations completed");
	} finally {
		await poolProvider.close();
	}
};

void main().catch((error) => {
	logger.error("Migration bootstrap failed", { error });
	process.exit(1);
});
