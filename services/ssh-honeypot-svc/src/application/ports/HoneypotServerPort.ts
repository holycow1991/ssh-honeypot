export interface HoneypotServerPort {
	start(): void;
	stop(): Promise<void>;
}
