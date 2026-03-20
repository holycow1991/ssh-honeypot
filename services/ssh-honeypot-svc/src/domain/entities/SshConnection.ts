export class SshConnection {
	public constructor(
		public readonly sourceIp: string,
		public readonly sourcePort: number,
		public readonly clientVersion: string,
		public readonly connectedAt: Date = new Date(),
	) {}
}
