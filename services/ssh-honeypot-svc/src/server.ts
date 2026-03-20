import { AppLoggerPort } from "@/application/ports/AppLoggerPort";
import { HoneypotServerPort } from "@/application/ports/HoneypotServerPort";
import { SshRequestEntryService } from "@/application/services/SshRequestEntryService";
import { RecordSshAuthenticationAttemptUseCase } from "@/application/use-cases/RecordSshAuthenticationAttemptUseCase";
import { RecordSshCommandExecutionUseCase } from "@/application/use-cases/RecordSshCommandExecutionUseCase";
import { env } from "@/common/utils/envConfig";
import { SshEventRepositoryPort } from "@/domain/ports/SshEventRepositoryPort";
import { PinoAppLogger } from "@/infrastructure/logging/PinoAppLogger";
import { InMemorySshEventRepository } from "@/infrastructure/persistence/InMemorySshEventRepository";
import { PgSshEventRepository } from "@/infrastructure/persistence/PgSshEventRepository";
import { PgHoneypotReadinessGuard } from "@/infrastructure/persistence/pg/PgHoneypotReadinessGuard";
import { PgPoolProvider } from "@/infrastructure/persistence/pg/PgPoolProvider";
import { SshHoneypotServer } from "@/infrastructure/server/ssh/SshHoneypotServer";

export class HoneypotRuntime {
	public constructor(
		private readonly server: HoneypotServerPort,
		private readonly logger: AppLoggerPort,
		private readonly startupChecks: Array<() => Promise<void>>,
		private readonly shutdownHooks: Array<() => Promise<void>>
	) {}

	public async start(): Promise<void> {
		for (const check of this.startupChecks) {
			await check();
		}

		this.server.start();
	}

	public async stop(): Promise<void> {
		let stopError: unknown;

		try {
			await this.server.stop();
		} catch (error) {
			stopError = error;
		}

		for (const hook of this.shutdownHooks) {
			try {
				await hook();
			} catch (error) {
				this.logger.error("Shutdown hook failed", { error });
				if (!stopError) {
					stopError = error;
				}
			}
		}

		if (stopError) {
			throw stopError;
		}
	}

	public info(message: string, context?: Record<string, unknown>): void {
		this.logger.info(message, context);
	}

	public error(message: string, context?: Record<string, unknown>): void {
		this.logger.error(message, context);
	}
}

const createMemoryEventRepository = (): SshEventRepositoryPort => new InMemorySshEventRepository();

const createPgEventRepository = (
	logger: AppLoggerPort,
	startupChecks: Array<() => Promise<void>>,
	shutdownHooks: Array<() => Promise<void>>
): SshEventRepositoryPort => {
	const poolProvider = new PgPoolProvider({
		host: env.PG_HOST,
		port: env.PG_PORT,
		user: env.PG_USER,
		password: env.PG_PASSWORD,
		database: env.PG_DATABASE,
	});
	const pool = poolProvider.getPool();
	const readinessGuard = new PgHoneypotReadinessGuard(pool, logger);

	startupChecks.push(() => readinessGuard.ensureReady());

	shutdownHooks.push(() => poolProvider.close());

	return new PgSshEventRepository(pool);
};

const selectEventRepository = (
	logger: AppLoggerPort,
	startupChecks: Array<() => Promise<void>>,
	shutdownHooks: Array<() => Promise<void>>
): SshEventRepositoryPort => {
	if (env.EVENT_STORE === "pg") {
		return createPgEventRepository(logger, startupChecks, shutdownHooks);
	}

	return createMemoryEventRepository();
};

const parseCommonPasswords = (csvPasswords: string): string[] =>
	csvPasswords
		.split(",")
		.map((password) => password.trim())
		.filter((password) => password.length > 0);

const createHoneypotRuntime = (): HoneypotRuntime => {
	const startupChecks: Array<() => Promise<void>> = [];
	const shutdownHooks: Array<() => Promise<void>> = [];
	const logger = new PinoAppLogger("ssh-honeypot");
	const eventRepository = selectEventRepository(logger, startupChecks, shutdownHooks);
	const recordAttemptUseCase = new RecordSshAuthenticationAttemptUseCase(eventRepository);
	const recordCommandUseCase = new RecordSshCommandExecutionUseCase(eventRepository);
	const requestEntry = new SshRequestEntryService(
		logger,
		recordAttemptUseCase,
		recordCommandUseCase,
		parseCommonPasswords(env.SSH_COMMON_PASSWORDS)
	);
	const server = new SshHoneypotServer(
		{
			host: env.HOST,
			port: env.SSH_PORT,
			ident: env.SSH_IDENT,
			banner: env.SSH_AUTH_BANNER,
		},
		requestEntry,
		logger
	);

	return new HoneypotRuntime(server, logger, startupChecks, shutdownHooks);
};

export { createHoneypotRuntime };
