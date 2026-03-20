import { SshConnection } from "@/domain/entities/SshConnection";

export class SshAuthenticationAttempt {
	public constructor(
		public readonly connection: SshConnection,
		public readonly username: string,
		public readonly method: string,
		public readonly password: string | undefined,
		public readonly attemptedAt: Date = new Date()
	) {}
}
