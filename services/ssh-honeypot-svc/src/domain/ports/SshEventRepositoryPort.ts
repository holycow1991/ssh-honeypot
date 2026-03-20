import { SshAuthenticationAttempt } from "@/domain/entities/SshAuthenticationAttempt";
import { SshCommandExecution } from "@/domain/entities/SshCommandExecution";

export interface SshEventRepositoryPort {
	saveAuthenticationAttempt(attempt: SshAuthenticationAttempt): Promise<void>;
	saveCommandExecution(commandExecution: SshCommandExecution): Promise<void>;
}
