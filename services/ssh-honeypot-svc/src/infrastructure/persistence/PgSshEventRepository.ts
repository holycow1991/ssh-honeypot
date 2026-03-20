import { SshAuthenticationAttempt } from "@/domain/entities/SshAuthenticationAttempt";
import type { Pool } from "pg";
import { SshEventRepositoryPort } from "@/domain/ports/SshEventRepositoryPort";

export class PgSshEventRepository implements SshEventRepositoryPort {
	public constructor(private readonly pool: Pool) {}

	public async saveAuthenticationAttempt(attempt: SshAuthenticationAttempt): Promise<void> {
		await this.pool.query(
			`INSERT INTO ssh_auth_attempts
			(source_ip, source_port, client_version, username, auth_method, password, attempted_at)
			VALUES ($1, $2, $3, $4, $5, $6, $7)`,
			[
				attempt.connection.sourceIp,
				attempt.connection.sourcePort,
				attempt.connection.clientVersion,
				attempt.username,
				attempt.method,
				attempt.password,
				attempt.attemptedAt,
			]
		);
	}
}
