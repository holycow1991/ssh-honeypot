import { SshAuthenticationAttempt } from "@/domain/entities/SshAuthenticationAttempt";
import { SshEventRepositoryPort } from "@/domain/ports/SshEventRepositoryPort";

export class RecordSshAuthenticationAttemptUseCase {
	public constructor(private readonly eventRepository: SshEventRepositoryPort) {}

	public async execute(attempt: SshAuthenticationAttempt): Promise<void> {
		await this.eventRepository.saveAuthenticationAttempt(attempt);
	}
}
