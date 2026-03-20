import { RecordSshAuthenticationAttemptUseCase } from "@/application/use-cases/RecordSshAuthenticationAttemptUseCase";
import { RecordSshCommandExecutionUseCase } from "@/application/use-cases/RecordSshCommandExecutionUseCase";
import { SshAuthenticationAttempt } from "@/domain/entities/SshAuthenticationAttempt";
import { SshCommandExecution } from "@/domain/entities/SshCommandExecution";
import { SshConnection } from "@/domain/entities/SshConnection";
import { InMemorySshEventRepository } from "@/infrastructure/persistence/InMemorySshEventRepository";
import { beforeEach, describe, expect, it } from "vitest";

const makeConnection = () => new SshConnection("1.2.3.4", 55000, "SSH-2.0-OpenSSH_8.9");

describe("RecordSshAuthenticationAttemptUseCase", () => {
	let repository: InMemorySshEventRepository;
	let useCase: RecordSshAuthenticationAttemptUseCase;

	beforeEach(() => {
		repository = new InMemorySshEventRepository();
		useCase = new RecordSshAuthenticationAttemptUseCase(repository);
	});

	it("saves the attempt to the repository", async () => {
		const attempt = new SshAuthenticationAttempt(makeConnection(), "root", "password", "secret");
		await useCase.execute(attempt);
		expect(repository.getSnapshot()).toHaveLength(1);
		expect(repository.getSnapshot()[0]).toBe(attempt);
	});

	it("saves multiple attempts", async () => {
		await useCase.execute(new SshAuthenticationAttempt(makeConnection(), "root", "password", "a"));
		await useCase.execute(new SshAuthenticationAttempt(makeConnection(), "admin", "password", "b"));
		expect(repository.getSnapshot()).toHaveLength(2);
	});
});

describe("RecordSshCommandExecutionUseCase", () => {
	let repository: InMemorySshEventRepository;
	let useCase: RecordSshCommandExecutionUseCase;

	beforeEach(() => {
		repository = new InMemorySshEventRepository();
		useCase = new RecordSshCommandExecutionUseCase(repository);
	});

	it("saves the command to the repository", async () => {
		const cmd = new SshCommandExecution(makeConnection(), "root", "ls -la");
		await useCase.execute(cmd);
		expect(repository.getCommandSnapshot()).toHaveLength(1);
		expect(repository.getCommandSnapshot()[0]).toBe(cmd);
	});

	it("saves multiple commands", async () => {
		await useCase.execute(new SshCommandExecution(makeConnection(), "root", "whoami"));
		await useCase.execute(new SshCommandExecution(makeConnection(), "root", "id"));
		expect(repository.getCommandSnapshot()).toHaveLength(2);
	});
});
