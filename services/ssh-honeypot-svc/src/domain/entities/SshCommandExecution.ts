import type { SshConnection } from "@/domain/entities/SshConnection";

export class SshCommandExecution {
	public constructor(
		public readonly connection: SshConnection,
		public readonly username: string,
		public readonly command: string,
		public readonly executedAt: Date = new Date(),
	) {}
}
