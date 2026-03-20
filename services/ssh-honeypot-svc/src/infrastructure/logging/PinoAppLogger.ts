import { type Logger, pino } from "pino";
import type { AppLoggerPort } from "@/application/ports/AppLoggerPort";

export class PinoAppLogger implements AppLoggerPort {
	private readonly logger: Logger;

	public constructor(name: string) {
		this.logger = pino({ name });
	}

	public info(message: string, context?: Record<string, unknown>): void {
		this.logger.info(context ?? {}, message);
	}

	public warn(message: string, context?: Record<string, unknown>): void {
		this.logger.warn(context ?? {}, message);
	}

	public debug(message: string, context?: Record<string, unknown>): void {
		this.logger.debug(context ?? {}, message);
	}

	public error(message: string, context?: Record<string, unknown>): void {
		this.logger.error(context ?? {}, message);
	}
}
