import type { AppLoggerPort } from "@/application/ports/AppLoggerPort";
import {
	AuthenticationDecision,
	type ShellCommandResult,
	type ShellSessionView,
	type SshRequestEntryPort,
} from "@/application/ports/SshRequestEntryPort";
import type { RecordSshAuthenticationAttemptUseCase } from "@/application/use-cases/RecordSshAuthenticationAttemptUseCase";
import type { RecordSshCommandExecutionUseCase } from "@/application/use-cases/RecordSshCommandExecutionUseCase";
import type { SshAuthenticationAttempt } from "@/domain/entities/SshAuthenticationAttempt";
import type { SshCommandExecution } from "@/domain/entities/SshCommandExecution";
import type { SshConnection } from "@/domain/entities/SshConnection";

export class SshRequestEntryService implements SshRequestEntryPort {
	private readonly acceptedPasswords: Set<string>;

	public constructor(
		private readonly logger: AppLoggerPort,
		private readonly recordAttemptUseCase: RecordSshAuthenticationAttemptUseCase,
		private readonly recordCommandUseCase: RecordSshCommandExecutionUseCase,
		commonPasswords: readonly string[],
	) {
		this.acceptedPasswords = new Set(
			commonPasswords.map((password) => password.trim()).filter((password) => password.length > 0),
		);
	}

	public handleConnection(connection: SshConnection): void {
		this.logger.info("Incoming SSH connection", {
			source: `${connection.sourceIp}:${connection.sourcePort}`,
			clientVersion: connection.clientVersion,
		});
	}

	public async handleAuthenticationAttempt(attempt: SshAuthenticationAttempt): Promise<AuthenticationDecision> {
		this.logger.warn("Captured SSH authentication attempt", {
			source: `${attempt.connection.sourceIp}:${attempt.connection.sourcePort}`,
			method: attempt.method,
			username: attempt.username,
			password: attempt.password,
		});

		await this.recordAttemptUseCase.execute(attempt);

		const decision = this.shouldAcceptAttempt(attempt) ? AuthenticationDecision.ACCEPT : AuthenticationDecision.REJECT;

		if (decision === AuthenticationDecision.ACCEPT) {
			this.logger.info("Accepted honeypot authentication", {
				source: `${attempt.connection.sourceIp}:${attempt.connection.sourcePort}`,
				username: attempt.username,
			});
		}

		return decision;
	}

	public handleClientReady(connection: SshConnection): void {
		this.logger.info("SSH client authenticated", {
			source: `${connection.sourceIp}:${connection.sourcePort}`,
		});
	}

	public handleClientError(connection: SshConnection, error: unknown): void {
		this.logger.debug("SSH client error", {
			source: `${connection.sourceIp}:${connection.sourcePort}`,
			error,
		});
	}

	public handleClientDisconnected(connection: SshConnection): void {
		this.logger.info("SSH client disconnected", {
			source: `${connection.sourceIp}:${connection.sourcePort}`,
		});
	}

	public handleShellOpened(connection: SshConnection, username: string): ShellSessionView {
		this.logger.info("Opened fake shell session", {
			source: `${connection.sourceIp}:${connection.sourcePort}`,
			username,
		});

		const shellType = username === "root" ? "#" : "$";
		const prompt = `${username}@ip-172-31-18-41:~${shellType} `;
		const banner = [
			"Welcome to Ubuntu 22.04.4 LTS (GNU/Linux 5.15.0-102-generic x86_64)",
			"",
			" * Documentation:  https://help.ubuntu.com",
			" * Management:     https://landscape.canonical.com",
			" * Support:        https://ubuntu.com/pro",
			"",
			`Last login: ${new Date().toUTCString()} from ${connection.sourceIp}`,
		].join("\n");

		return { banner, prompt };
	}

	public async handleCommandExecution(commandExecution: SshCommandExecution): Promise<ShellCommandResult> {
		this.logger.warn("Captured shell command", {
			source: `${commandExecution.connection.sourceIp}:${commandExecution.connection.sourcePort}`,
			username: commandExecution.username,
			command: commandExecution.command,
		});

		await this.recordCommandUseCase.execute(commandExecution);

		const prompt = this.getPrompt(commandExecution.username);
		const normalizedCommand = commandExecution.command.trim();

		switch (normalizedCommand) {
			case "":
				return { output: "", prompt, closeSession: false };
			case "^C":
				return { output: "^C", prompt, closeSession: false };
			case "help":
				return {
					output: "Supported commands: help, whoami, id, pwd, uname -a, ls, ls -la, cat /etc/passwd, ps, exit, logout",
					prompt,
					closeSession: false,
				};
			case "whoami":
				return { output: commandExecution.username, prompt, closeSession: false };
			case "id":
				return {
					output:
						commandExecution.username === "root"
							? "uid=0(root) gid=0(root) groups=0(root)"
							: `uid=1001(${commandExecution.username}) gid=1001(${commandExecution.username}) groups=1001(${commandExecution.username}),27(sudo)`,
					prompt,
					closeSession: false,
				};
			case "pwd":
				return {
					output: commandExecution.username === "root" ? "/root" : `/home/${commandExecution.username}`,
					prompt,
					closeSession: false,
				};
			case "uname -a":
				return {
					output: "Linux ip-172-31-18-41 5.15.0-102-generic #112-Ubuntu SMP x86_64 GNU/Linux",
					prompt,
					closeSession: false,
				};
			case "ls":
				return {
					output: "backup.tar.gz  logs  .ssh  .bash_history",
					prompt,
					closeSession: false,
				};
			case "ls -la":
				return {
					output: [
						"total 40",
						"drwxr-xr-x 5 root root 4096 Mar 20 10:24 .",
						"drwxr-xr-x 3 root root 4096 Mar 20 09:10 ..",
						"-rw------- 1 root root 1234 Mar 20 10:12 .bash_history",
						"drwx------ 2 root root 4096 Mar 20 09:45 .ssh",
						"-rw-r--r-- 1 root root 2048 Mar 19 22:31 backup.tar.gz",
						"drwxr-xr-x 2 root root 4096 Mar 19 21:55 logs",
					].join("\n"),
					prompt,
					closeSession: false,
				};
			case "cat /etc/passwd":
				return {
					output: [
						"root:x:0:0:root:/root:/bin/bash",
						"daemon:x:1:1:daemon:/usr/sbin:/usr/sbin/nologin",
						"bin:x:2:2:bin:/bin:/usr/sbin/nologin",
						"sys:x:3:3:sys:/dev:/usr/sbin/nologin",
						"www-data:x:33:33:www-data:/var/www:/usr/sbin/nologin",
						"ubuntu:x:1000:1000:Ubuntu:/home/ubuntu:/bin/bash",
					].join("\n"),
					prompt,
					closeSession: false,
				};
			case "ps":
				return {
					output: ["  PID TTY          TIME CMD", "  922 pts/0    00:00:00 bash", " 1044 pts/0    00:00:00 ps"].join(
						"\n",
					),
					prompt,
					closeSession: false,
				};
			case "exit":
			case "logout":
				return { output: "logout", prompt, closeSession: true };
			default:
				return {
					output: `bash: ${normalizedCommand}: command not found`,
					prompt,
					closeSession: false,
				};
		}
	}

	private shouldAcceptAttempt(attempt: SshAuthenticationAttempt): boolean {
		if (attempt.method !== "password" || !attempt.password) {
			return false;
		}

		if (!attempt.username.trim()) {
			return false;
		}

		return this.acceptedPasswords.has(attempt.password);
	}

	private getPrompt(username: string): string {
		const shellType = username === "root" ? "#" : "$";
		return `${username}@ip-172-31-18-41:~${shellType} `;
	}
}
