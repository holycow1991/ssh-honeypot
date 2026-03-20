import { SshAuthenticationAttempt } from "@/domain/entities/SshAuthenticationAttempt";

export interface SshEventRepositoryPort {
	saveAuthenticationAttempt(attempt: SshAuthenticationAttempt): Promise<void>;
}
