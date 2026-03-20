import type { AppLoggerPort } from "@/application/ports/AppLoggerPort";
import { AuthenticationDecision } from "@/application/ports/SshRequestEntryPort";
import { SshRequestEntryService } from "@/application/services/SshRequestEntryService";
import { RecordSshAuthenticationAttemptUseCase } from "@/application/use-cases/RecordSshAuthenticationAttemptUseCase";
import { RecordSshCommandExecutionUseCase } from "@/application/use-cases/RecordSshCommandExecutionUseCase";
import { SshAuthenticationAttempt } from "@/domain/entities/SshAuthenticationAttempt";
import { SshCommandExecution } from "@/domain/entities/SshCommandExecution";
import { SshConnection } from "@/domain/entities/SshConnection";
import { InMemorySshEventRepository } from "@/infrastructure/persistence/InMemorySshEventRepository";
import { beforeEach, describe, expect, it, vi } from "vitest";

const makeLogger = (): AppLoggerPort => ({
	info: vi.fn(),
	warn: vi.fn(),
	debug: vi.fn(),
	error: vi.fn(),
});

const makeConnection = (ip = "1.2.3.4", port = 55000) =>
	new SshConnection(ip, port, "SSH-2.0-OpenSSH_8.9");

const makeAttempt = (username: string, password: string | undefined, method = "password") =>
	new SshAuthenticationAttempt(makeConnection(), username, method, password);

const makeCommand = (command: string, username = "root") =>
	new SshCommandExecution(makeConnection(), username, command);

describe("SshRequestEntryService", () => {
	let repository: InMemorySshEventRepository;
	let service: SshRequestEntryService;
	let logger: AppLoggerPort;

	beforeEach(() => {
		repository = new InMemorySshEventRepository();
		logger = makeLogger();
		const recordAttempt = new RecordSshAuthenticationAttemptUseCase(repository);
		const recordCommand = new RecordSshCommandExecutionUseCase(repository);
		service = new SshRequestEntryService(logger, recordAttempt, recordCommand, [
			"password",
			"123456",
			"admin",
		]);
	});

	describe("handleAuthenticationAttempt", () => {
		it("accepts a known password", async () => {
			const decision = await service.handleAuthenticationAttempt(makeAttempt("root", "password"));
			expect(decision).toBe(AuthenticationDecision.ACCEPT);
		});

		it("rejects an unknown password", async () => {
			const decision = await service.handleAuthenticationAttempt(makeAttempt("root", "wrongpass"));
			expect(decision).toBe(AuthenticationDecision.REJECT);
		});

		it("rejects when password is undefined", async () => {
			const decision = await service.handleAuthenticationAttempt(makeAttempt("root", undefined));
			expect(decision).toBe(AuthenticationDecision.REJECT);
		});

		it("rejects non-password auth methods", async () => {
			const decision = await service.handleAuthenticationAttempt(
				makeAttempt("root", "password", "publickey"),
			);
			expect(decision).toBe(AuthenticationDecision.REJECT);
		});

		it("rejects blank username", async () => {
			const decision = await service.handleAuthenticationAttempt(makeAttempt("  ", "password"));
			expect(decision).toBe(AuthenticationDecision.REJECT);
		});

		it("records every attempt regardless of decision", async () => {
			await service.handleAuthenticationAttempt(makeAttempt("root", "password"));
			await service.handleAuthenticationAttempt(makeAttempt("admin", "wrongpass"));
			expect(repository.getSnapshot()).toHaveLength(2);
		});

		it("trims whitespace from accepted passwords at construction time", async () => {
			const recordAttempt = new RecordSshAuthenticationAttemptUseCase(repository);
			const recordCommand = new RecordSshCommandExecutionUseCase(repository);
			const svc = new SshRequestEntryService(logger, recordAttempt, recordCommand, ["  admin  "]);
			const decision = await svc.handleAuthenticationAttempt(makeAttempt("user", "admin"));
			expect(decision).toBe(AuthenticationDecision.ACCEPT);
		});
	});

	describe("handleShellOpened", () => {
		it("returns # prompt for root", () => {
			const { prompt } = service.handleShellOpened(makeConnection(), "root");
			expect(prompt).toContain("root@");
			expect(prompt).toContain("#");
		});

		it("returns $ prompt for non-root user", () => {
			const { prompt } = service.handleShellOpened(makeConnection(), "ubuntu");
			expect(prompt).toContain("ubuntu@");
			expect(prompt).toContain("$");
		});

		it("banner contains Ubuntu welcome text", () => {
			const { banner } = service.handleShellOpened(makeConnection(), "root");
			expect(banner).toContain("Ubuntu 22.04");
		});

		it("banner contains the client IP", () => {
			const { banner } = service.handleShellOpened(makeConnection("9.9.9.9"), "root");
			expect(banner).toContain("9.9.9.9");
		});
	});

	describe("handleCommandExecution", () => {
		it("records every command", async () => {
			await service.handleCommandExecution(makeCommand("whoami"));
			await service.handleCommandExecution(makeCommand("pwd"));
			expect(repository.getCommandSnapshot()).toHaveLength(2);
		});

		it("returns username for whoami", async () => {
			const { output } = await service.handleCommandExecution(makeCommand("whoami", "ubuntu"));
			expect(output).toBe("ubuntu");
		});

		it("returns root id string for root", async () => {
			const { output } = await service.handleCommandExecution(makeCommand("id", "root"));
			expect(output).toContain("uid=0(root)");
		});

		it("returns non-root id string for regular user", async () => {
			const { output } = await service.handleCommandExecution(makeCommand("id", "ubuntu"));
			expect(output).toContain("uid=1001(ubuntu)");
			expect(output).toContain("sudo");
		});

		it("returns /root for pwd as root", async () => {
			const { output } = await service.handleCommandExecution(makeCommand("pwd", "root"));
			expect(output).toBe("/root");
		});

		it("returns /home/<user> for pwd as non-root", async () => {
			const { output } = await service.handleCommandExecution(makeCommand("pwd", "ubuntu"));
			expect(output).toBe("/home/ubuntu");
		});

		it("returns uname output", async () => {
			const { output } = await service.handleCommandExecution(makeCommand("uname -a"));
			expect(output).toContain("Linux");
		});

		it("returns file list for ls", async () => {
			const { output } = await service.handleCommandExecution(makeCommand("ls"));
			expect(output).toContain(".ssh");
		});

		it("returns detailed listing for ls -la", async () => {
			const { output } = await service.handleCommandExecution(makeCommand("ls -la"));
			expect(output).toContain("drwx------");
		});

		it("returns passwd file content for cat /etc/passwd", async () => {
			const { output } = await service.handleCommandExecution(makeCommand("cat /etc/passwd"));
			expect(output).toContain("root:x:0:0");
		});

		it("returns process list for ps", async () => {
			const { output } = await service.handleCommandExecution(makeCommand("ps"));
			expect(output).toContain("bash");
		});

		it("returns supported commands list for help", async () => {
			const { output } = await service.handleCommandExecution(makeCommand("help"));
			expect(output).toContain("whoami");
		});

		it("closes session on exit", async () => {
			const result = await service.handleCommandExecution(makeCommand("exit"));
			expect(result.closeSession).toBe(true);
		});

		it("closes session on logout", async () => {
			const result = await service.handleCommandExecution(makeCommand("logout"));
			expect(result.closeSession).toBe(true);
		});

		it("returns command not found for unknown command", async () => {
			const { output } = await service.handleCommandExecution(makeCommand("curl http://evil.com"));
			expect(output).toContain("command not found");
			expect(output).toContain("curl http://evil.com");
		});

		it("handles empty command without closing session", async () => {
			const result = await service.handleCommandExecution(makeCommand(""));
			expect(result.closeSession).toBe(false);
			expect(result.output).toBe("");
		});

		it("trims whitespace from command before matching", async () => {
			const { output } = await service.handleCommandExecution(makeCommand("  whoami  ", "ubuntu"));
			expect(output).toBe("ubuntu");
		});
	});
});
