import type { SshAuthenticationAttempt } from "@/domain/entities/SshAuthenticationAttempt";
import type { SshCommandExecution } from "@/domain/entities/SshCommandExecution";
import type { SshEventRepositoryPort } from "@/domain/ports/SshEventRepositoryPort";

export class InMemorySshEventRepository implements SshEventRepositoryPort {
	private readonly attempts: SshAuthenticationAttempt[] = [];
	private readonly commands: SshCommandExecution[] = [];

	public async saveAuthenticationAttempt(attempt: SshAuthenticationAttempt): Promise<void> {
		this.attempts.push(attempt);
	}

	public async saveCommandExecution(commandExecution: SshCommandExecution): Promise<void> {
		this.commands.push(commandExecution);
	}

	public getSnapshot(): readonly SshAuthenticationAttempt[] {
		return this.attempts;
	}

	public getCommandSnapshot(): readonly SshCommandExecution[] {
		return this.commands;
	}
}
