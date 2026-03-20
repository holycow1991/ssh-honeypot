import { createHoneypotRuntime } from "@/server";

const main = async (): Promise<void> => {
	const runtime = createHoneypotRuntime();
	await runtime.start();

	const onCloseSignal = () => {
		runtime.info("Shutdown signal received, closing SSH honeypot");
		void runtime
			.stop()
			.then(() => {
				runtime.info("SSH honeypot server closed");
				process.exit();
			})
			.catch((error) => {
				runtime.error("Failed to close SSH honeypot server cleanly", { error });
				process.exit(1);
			});

		setTimeout(() => process.exit(1), 10000).unref();
	};

	process.on("SIGINT", onCloseSignal);
	process.on("SIGTERM", onCloseSignal);
};

void main().catch((error) => {
	console.error("Failed to start SSH honeypot runtime", error);
	process.exit(1);
});
