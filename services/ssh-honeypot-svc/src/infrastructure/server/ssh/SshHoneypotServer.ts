import { generateKeyPairSync } from "node:crypto";
import { type AuthContext, Server, type ServerChannel, type Session } from "ssh2";
import type { AppLoggerPort } from "@/application/ports/AppLoggerPort";
import type { HoneypotServerPort } from "@/application/ports/HoneypotServerPort";
import { AuthenticationDecision, type SshRequestEntryPort } from "@/application/ports/SshRequestEntryPort";
import { SshAuthenticationAttempt } from "@/domain/entities/SshAuthenticationAttempt";
import { SshCommandExecution } from "@/domain/entities/SshCommandExecution";
import { SshConnection } from "@/domain/entities/SshConnection";

export interface SshHoneypotServerConfig {
	host: string;
	port: number;
	ident: string;
	banner: string;
}

export class SshHoneypotServer implements HoneypotServerPort {
	private server: Server | undefined;

	public constructor(
		private readonly config: SshHoneypotServerConfig,
		private readonly requestEntry: SshRequestEntryPort,
		private readonly logger: AppLoggerPort,
	) {}

	public start(): void {
		if (this.server) {
			return;
		}

		const hostKey = this.createHostKey();
		this.server = new Server(
			{
				hostKeys: [hostKey],
				ident: this.config.ident,
				banner: this.config.banner,
			},
			(client, info) => {
				let authenticatedUsername: string | undefined;
				const connection = new SshConnection(info.ip, info.port, info.header.versions.software ?? "unknown");

				this.requestEntry.handleConnection(connection);

				client.on("authentication", (ctx) => {
					void this.handleAuthentication(ctx, connection, (username) => {
						authenticatedUsername = username;
					});
				});

				client.on("ready", () => {
					this.requestEntry.handleClientReady(connection);
				});

				client.on("session", (accept, reject) => {
					if (!authenticatedUsername) {
						reject();
						return;
					}

					const session = accept();
					this.bindSessionHandlers(session, client, connection, authenticatedUsername);
				});

				client.on("error", (error) => {
					this.requestEntry.handleClientError(connection, error);
				});

				client.on("end", () => {
					this.requestEntry.handleClientDisconnected(connection);
				});
			},
		);

		this.server.on("error", (error: unknown) => {
			this.logger.error("SSH honeypot server error", { error });
		});

		this.server.listen(this.config.port, this.config.host, () => {
			this.logger.info("SSH honeypot listening", {
				host: this.config.host,
				port: this.config.port,
				ident: this.config.ident,
			});
		});
	}

	public async stop(): Promise<void> {
		if (!this.server) {
			return;
		}

		await new Promise<void>((resolve, reject) => {
			this.server?.close((error) => {
				if (error) {
					reject(error);
					return;
				}

				resolve();
			});
		});

		this.server = undefined;
	}

	private createHostKey(): string {
		const { privateKey } = generateKeyPairSync("rsa", {
			modulusLength: 2048,
			privateKeyEncoding: {
				type: "pkcs1",
				format: "pem",
			},
			publicKeyEncoding: {
				type: "spki",
				format: "pem",
			},
		});

		return privateKey;
	}

	private async handleAuthentication(
		ctx: AuthContext,
		connection: SshConnection,
		onAccepted: (username: string) => void,
	): Promise<void> {
		const password = this.extractPassword(ctx);
		const attempt = new SshAuthenticationAttempt(connection, ctx.username, ctx.method, password);

		try {
			const decision = await this.requestEntry.handleAuthenticationAttempt(attempt);
			if (decision === AuthenticationDecision.ACCEPT) {
				onAccepted(ctx.username);
				ctx.accept();
				return;
			}

			ctx.reject();
		} catch (error) {
			this.requestEntry.handleClientError(connection, error);
			ctx.reject();
		}
	}

	private bindSessionHandlers(
		session: Session,
		client: { end(): void },
		connection: SshConnection,
		username: string,
	): void {
		session.on("pty", (accept) => {
			accept();
		});

		session.on("shell", (accept) => {
			const channel = accept();
			const view = this.requestEntry.handleShellOpened(connection, username);
			channel.write(this.toWireText(`${view.banner}\n`));
			channel.write(this.toWireText(view.prompt));
			this.bindShellCommandHandlers(channel, client, connection, username);
		});

		session.on("exec", (accept, _reject, info) => {
			const channel = accept();
			void this.requestEntry
				.handleCommandExecution(new SshCommandExecution(connection, username, info.command))
				.then((result) => {
					if (result.output.length > 0) {
						channel.write(this.toWireText(`${result.output}\n`));
					}

					channel.end();

					if (result.closeSession) {
						client.end();
					}
				})
				.catch((error) => {
					this.requestEntry.handleClientError(connection, error);
					channel.end(this.toWireText("Connection closed by remote host.\n"));
					client.end();
				});
		});
	}

	private bindShellCommandHandlers(
		channel: ServerChannel,
		client: { end(): void },
		connection: SshConnection,
		username: string,
	): void {
		let commandBuffer = "";
		let commandQueue = Promise.resolve();

		channel.on("data", (data: Buffer | string) => {
			const chunk = this.normalizeInputChunk(data.toString("utf-8"));

			if (chunk.includes("\u0003")) {
				commandBuffer = "";
				commandQueue = commandQueue
					.then(async () => {
						const commandExecution = new SshCommandExecution(connection, username, "^C");
						const result = await this.requestEntry.handleCommandExecution(commandExecution);

						if (result.output.length > 0) {
							channel.write(this.toWireText(`${result.output}\n`));
						}

						if (result.closeSession) {
							channel.end(this.toWireText("Connection to localhost closed.\n"));
							client.end();
							return;
						}

						channel.write(this.toWireText(result.prompt));
					})
					.catch((error) => {
						this.requestEntry.handleClientError(connection, error);
						channel.write(this.toWireText("Connection closed by remote host.\n"));
						channel.end();
						client.end();
					});
				return;
			}

			commandBuffer += chunk;

			const parsed = this.consumeCommandLines(commandBuffer);
			commandBuffer = parsed.remaining;

			for (const line of parsed.commands) {
				commandQueue = commandQueue
					.then(async () => {
						const commandExecution = new SshCommandExecution(connection, username, line);
						const result = await this.requestEntry.handleCommandExecution(commandExecution);

						if (result.output.length > 0) {
							channel.write(this.toWireText(`${result.output}\n`));
						}

						if (result.closeSession) {
							channel.end(this.toWireText("Connection to localhost closed.\n"));
							client.end();
							return;
						}

						channel.write(this.toWireText(result.prompt));
					})
					.catch((error) => {
						this.requestEntry.handleClientError(connection, error);
						channel.write(this.toWireText("Connection closed by remote host.\n"));
						channel.end();
						client.end();
					});
			}
		});
	}

	private consumeCommandLines(buffer: string): { commands: string[]; remaining: string } {
		const commands: string[] = [];
		let remaining = buffer;

		let index = remaining.indexOf("\n");
		while (index !== -1) {
			commands.push(remaining.slice(0, index));
			remaining = remaining.slice(index + 1);
			index = remaining.indexOf("\n");
		}

		return { commands, remaining };
	}

	private normalizeInputChunk(chunk: string): string {
		return chunk.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
	}

	private toWireText(text: string): string {
		return text.replace(/\n/g, "\r\n");
	}

	private extractPassword(ctx: AuthContext): string | undefined {
		if (ctx.method !== "password") {
			return undefined;
		}

		return ctx.password;
	}
}
