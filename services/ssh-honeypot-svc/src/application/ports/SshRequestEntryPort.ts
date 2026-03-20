import { SshAuthenticationAttempt } from "@/domain/entities/SshAuthenticationAttempt";
import { SshConnection } from "@/domain/entities/SshConnection";

export enum AuthenticationDecision {
	ACCEPT = "accept",
	REJECT = "reject",
}

export interface SshRequestEntryPort {
	handleConnection(connection: SshConnection): void;
	handleAuthenticationAttempt(attempt: SshAuthenticationAttempt): Promise<AuthenticationDecision>;
	handleClientReady(connection: SshConnection): void;
	handleClientError(connection: SshConnection, error: unknown): void;
	handleClientDisconnected(connection: SshConnection): void;
}
