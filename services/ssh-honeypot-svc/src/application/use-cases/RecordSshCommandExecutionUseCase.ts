import { SshCommandExecution } from "@/domain/entities/SshCommandExecution";
import { SshEventRepositoryPort } from "@/domain/ports/SshEventRepositoryPort";

export class RecordSshCommandExecutionUseCase {
	public constructor(private readonly eventRepository: SshEventRepositoryPort) {}

	public async execute(commandExecution: SshCommandExecution): Promise<void> {
		await this.eventRepository.saveCommandExecution(commandExecution);
	}
}
