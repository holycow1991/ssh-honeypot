import { generateKeyPairSync } from "node:crypto";
import { Server } from "ssh2";
import { AuthenticationDecision, SshRequestEntryPort } from "@/application/ports/SshRequestEntryPort";
import { HoneypotServerPort } from "@/application/ports/HoneypotServerPort";
import { AppLoggerPort } from "@/application/ports/AppLoggerPort";
import { SshAuthenticationAttempt } from "@/domain/entities/SshAuthenticationAttempt";
import { SshConnection } from "@/domain/entities/SshConnection";

interface SshAuthenticationContext {
	method: string;
	username: string;
	password?: string;
	accept(): void;
	reject(): void;
}

export interface SshHoneypotServerConfig {
	host: string;
	port: number;
	ident: string;
}

export class SshHoneypotServer implements HoneypotServerPort {
	private server: Server | undefined;

	public constructor(
		private readonly config: SshHoneypotServerConfig,
		private readonly requestEntry: SshRequestEntryPort,
		private readonly logger: AppLoggerPort
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
			},
			(client, info) => {
				const connection = new SshConnection(
					info.ip,
					info.port,
					info.header.versions.software ?? "unknown"
				);

				this.requestEntry.handleConnection(connection);

				client.on("authentication", (ctx) => {
					void this.handleAuthentication(ctx, connection);
				});

				client.on("ready", () => {
					this.requestEntry.handleClientReady(connection);
					client.end();
				});

				client.on("error", (error) => {
					this.requestEntry.handleClientError(connection, error);
				});

				client.on("end", () => {
					this.requestEntry.handleClientDisconnected(connection);
				});
			}
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

	private async handleAuthentication(ctx: SshAuthenticationContext, connection: SshConnection): Promise<void> {
		const password = this.extractPassword(ctx);
		const attempt = new SshAuthenticationAttempt(connection, ctx.username, ctx.method, password);

		try {
			const decision = await this.requestEntry.handleAuthenticationAttempt(attempt);
			if (decision === AuthenticationDecision.ACCEPT) {
				ctx.accept();
				return;
			}

			ctx.reject();
		} catch (error) {
			this.requestEntry.handleClientError(connection, error);
			ctx.reject();
		}
	}

	private extractPassword(ctx: SshAuthenticationContext): string | undefined {
		if (ctx.method !== "password") {
			return undefined;
		}

		return ctx.password;
	}
}
