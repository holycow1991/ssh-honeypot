import { beforeEach, describe, expect, it } from "vitest";
import { SshAuthenticationAttempt } from "@/domain/entities/SshAuthenticationAttempt";
import { SshCommandExecution } from "@/domain/entities/SshCommandExecution";
import { SshConnection } from "@/domain/entities/SshConnection";
import { InMemorySshEventRepository } from "@/infrastructure/persistence/InMemorySshEventRepository";

const makeConnection = () => new SshConnection("10.0.0.1", 12345, "SSH-2.0-OpenSSH_8.9");

describe("InMemorySshEventRepository", () => {
	let repository: InMemorySshEventRepository;

	beforeEach(() => {
		repository = new InMemorySshEventRepository();
	});

	it("starts empty", () => {
		expect(repository.getSnapshot()).toHaveLength(0);
		expect(repository.getCommandSnapshot()).toHaveLength(0);
	});

	it("saves and retrieves an authentication attempt", async () => {
		const attempt = new SshAuthenticationAttempt(makeConnection(), "root", "password", "secret");
		await repository.saveAuthenticationAttempt(attempt);
		expect(repository.getSnapshot()).toHaveLength(1);
		expect(repository.getSnapshot()[0]).toBe(attempt);
	});

	it("saves and retrieves a command execution", async () => {
		const cmd = new SshCommandExecution(makeConnection(), "root", "whoami");
		await repository.saveCommandExecution(cmd);
		expect(repository.getCommandSnapshot()).toHaveLength(1);
		expect(repository.getCommandSnapshot()[0]).toBe(cmd);
	});

	it("stores attempts and commands independently", async () => {
		await repository.saveAuthenticationAttempt(
			new SshAuthenticationAttempt(makeConnection(), "root", "password", "pass"),
		);
		await repository.saveCommandExecution(new SshCommandExecution(makeConnection(), "root", "ls"));
		expect(repository.getSnapshot()).toHaveLength(1);
		expect(repository.getCommandSnapshot()).toHaveLength(1);
	});

	it("accumulates multiple entries", async () => {
		for (let i = 0; i < 5; i++) {
			await repository.saveAuthenticationAttempt(
				new SshAuthenticationAttempt(makeConnection(), `user${i}`, "password", "pass"),
			);
		}
		expect(repository.getSnapshot()).toHaveLength(5);
	});
});
