import type { SshAuthenticationAttempt } from "@/domain/entities/SshAuthenticationAttempt";
import type { SshCommandExecution } from "@/domain/entities/SshCommandExecution";

export interface SshEventRepositoryPort {
	saveAuthenticationAttempt(attempt: SshAuthenticationAttempt): Promise<void>;
	saveCommandExecution(commandExecution: SshCommandExecution): Promise<void>;
}
