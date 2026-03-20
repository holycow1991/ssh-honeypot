import type { Pool } from "pg";
import type { SshAuthenticationAttempt } from "@/domain/entities/SshAuthenticationAttempt";
import type { SshCommandExecution } from "@/domain/entities/SshCommandExecution";
import type { SshEventRepositoryPort } from "@/domain/ports/SshEventRepositoryPort";

export class PgSshEventRepository implements SshEventRepositoryPort {
	public constructor(private readonly pool: Pool) {}

	public async saveAuthenticationAttempt(attempt: SshAuthenticationAttempt): Promise<void> {
		await this.pool.query(
			`INSERT INTO ssh_events
			(event_type, source_ip, source_port, client_version, username, occurred_at, event_payload)
			VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)`,
			[
				"auth_attempt",
				attempt.connection.sourceIp,
				attempt.connection.sourcePort,
				attempt.connection.clientVersion,
				attempt.username,
				attempt.attemptedAt,
				JSON.stringify({
					method: attempt.method,
					password: attempt.password,
					attemptedAt: attempt.attemptedAt.toISOString(),
				}),
			],
		);
	}

	public async saveCommandExecution(commandExecution: SshCommandExecution): Promise<void> {
		await this.pool.query(
			`INSERT INTO ssh_events
			(event_type, source_ip, source_port, client_version, username, occurred_at, event_payload)
			VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)`,
			[
				"command_execution",
				commandExecution.connection.sourceIp,
				commandExecution.connection.sourcePort,
				commandExecution.connection.clientVersion,
				commandExecution.username,
				commandExecution.executedAt,
				JSON.stringify({
					command: commandExecution.command,
					executedAt: commandExecution.executedAt.toISOString(),
				}),
			],
		);
	}
}
