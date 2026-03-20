import { AppLoggerPort } from "@/application/ports/AppLoggerPort";
import {
	AuthenticationDecision,
	SshRequestEntryPort,
} from "@/application/ports/SshRequestEntryPort";
import { RecordSshAuthenticationAttemptUseCase } from "@/application/use-cases/RecordSshAuthenticationAttemptUseCase";
import { SshAuthenticationAttempt } from "@/domain/entities/SshAuthenticationAttempt";
import { SshConnection } from "@/domain/entities/SshConnection";

export class SshRequestEntryService implements SshRequestEntryPort {
	public constructor(
		private readonly logger: AppLoggerPort,
		private readonly recordAttemptUseCase: RecordSshAuthenticationAttemptUseCase
	) {}

	public handleConnection(connection: SshConnection): void {
		this.logger.info("Incoming SSH connection", {
			source: `${connection.sourceIp}:${connection.sourcePort}`,
			clientVersion: connection.clientVersion,
		});
	}

	public async handleAuthenticationAttempt(attempt: SshAuthenticationAttempt): Promise<AuthenticationDecision> {
		this.logger.warn("Captured SSH authentication attempt", {
			source: `${attempt.connection.sourceIp}:${attempt.connection.sourcePort}`,
			method: attempt.method,
			username: attempt.username,
			password: attempt.password,
		});

		await this.recordAttemptUseCase.execute(attempt);
		return AuthenticationDecision.REJECT;
	}

	public handleClientReady(connection: SshConnection): void {
		this.logger.warn("Unexpected SSH authentication success; closing connection", {
			source: `${connection.sourceIp}:${connection.sourcePort}`,
		});
	}

	public handleClientError(connection: SshConnection, error: unknown): void {
		this.logger.debug("SSH client error", {
			source: `${connection.sourceIp}:${connection.sourcePort}`,
			error,
		});
	}

	public handleClientDisconnected(connection: SshConnection): void {
		this.logger.info("SSH client disconnected", {
			source: `${connection.sourceIp}:${connection.sourcePort}`,
		});
	}
}
