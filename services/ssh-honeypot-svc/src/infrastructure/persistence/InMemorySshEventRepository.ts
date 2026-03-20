import { SshAuthenticationAttempt } from "@/domain/entities/SshAuthenticationAttempt";
import { SshEventRepositoryPort } from "@/domain/ports/SshEventRepositoryPort";

export class InMemorySshEventRepository implements SshEventRepositoryPort {
	private readonly attempts: SshAuthenticationAttempt[] = [];

	public async saveAuthenticationAttempt(attempt: SshAuthenticationAttempt): Promise<void> {
		this.attempts.push(attempt);
	}

	public getSnapshot(): readonly SshAuthenticationAttempt[] {
		return this.attempts;
	}
}
