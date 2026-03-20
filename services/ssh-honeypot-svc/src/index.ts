import { logger, startSshHoneypot } from "@/server";

const server = startSshHoneypot();

const onCloseSignal = () => {
	logger.info("Shutdown signal received, closing SSH honeypot");
	server.close(() => {
		logger.info("SSH honeypot server closed");
		process.exit();
	});
	setTimeout(() => process.exit(1), 10000).unref(); // Force shutdown after 10s
};

process.on("SIGINT", onCloseSignal);
process.on("SIGTERM", onCloseSignal);
