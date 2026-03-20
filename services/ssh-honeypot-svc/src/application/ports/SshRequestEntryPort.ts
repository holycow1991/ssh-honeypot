import type { SshAuthenticationAttempt } from "@/domain/entities/SshAuthenticationAttempt";
import type { SshCommandExecution } from "@/domain/entities/SshCommandExecution";
import type { SshConnection } from "@/domain/entities/SshConnection";

export enum AuthenticationDecision {
	ACCEPT = "accept",
	REJECT = "reject",
}

export interface ShellSessionView {
	banner: string;
	prompt: string;
}

export interface ShellCommandResult {
	output: string;
	prompt: string;
	closeSession: boolean;
}

export interface SshRequestEntryPort {
	handleConnection(connection: SshConnection): void;
	handleAuthenticationAttempt(attempt: SshAuthenticationAttempt): Promise<AuthenticationDecision>;
	handleClientReady(connection: SshConnection): void;
	handleClientError(connection: SshConnection, error: unknown): void;
	handleClientDisconnected(connection: SshConnection): void;
	handleShellOpened(connection: SshConnection, username: string): ShellSessionView;
	handleCommandExecution(commandExecution: SshCommandExecution): Promise<ShellCommandResult>;
}
