import type { SshAuthenticationAttempt } from "@/domain/entities/SshAuthenticationAttempt";
import type { SshEventRepositoryPort } from "@/domain/ports/SshEventRepositoryPort";

export class RecordSshAuthenticationAttemptUseCase {
	public constructor(private readonly eventRepository: SshEventRepositoryPort) {}

	public async execute(attempt: SshAuthenticationAttempt): Promise<void> {
		await this.eventRepository.saveAuthenticationAttempt(attempt);
	}
}
