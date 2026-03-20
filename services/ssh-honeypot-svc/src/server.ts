import errorHandler from "@/common/middleware/errorHandler";
import requestLogger from "@/common/middleware/requestLogger";
import { env } from "@/common/utils/envConfig";
import express, { type Express } from "express";
import helmet from "helmet";
import { generateKeyPairSync } from "node:crypto";
import { pino } from "pino";
import { Server } from "ssh2";

const logger = pino({ name: "server start" });
const app: Express = express();

// Set the application to trust the reverse proxy
app.set("trust proxy", true);

app.use(helmet());

// Request logging
app.use(requestLogger);

app.use(errorHandler());

const createHostKey = () => {
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
};

const createSshHoneypotServer = () => {
  const hostKey = createHostKey();

  const sshServer = new Server(
    {
      hostKeys: [hostKey],
      ident: env.SSH_IDENT,
    },
    (client, info) => {
      const source = `${info.ip}:${info.port}`;
      logger.info(
        {
          source,
          clientVersion: info.header.versions.software,
        },
        "Incoming SSH connection",
      );

      client.on("authentication", (ctx) => {
        const method = ctx.method;
        logger.warn(
          {
            source,
            method,
            username: ctx.username,
            password: method === "password" ? ctx.password : undefined,
          },
          "Captured SSH authentication attempt",
        );

        if (ctx.username === "root" && method === "password") {
          logger.warn(
            {
              source,
              method,
              username: ctx.username,
              password: ctx.password,
            },
            "Captured SSH authentication success attempt with root user",
          );
          ctx.accept();
        } else {
          ctx.reject();
        }
      });

      client.on("ready", () => {
        logger.warn(
          { source },
          "Unexpected SSH authentication success; closing connection",
        );
        client.end();
      });

      client.on("error", (error) => {
        logger.debug({ source, error }, "SSH client error");
      });

      client.on("end", () => {
        logger.info({ source }, "SSH client disconnected");
      });
    },
  );

  sshServer.on("error", (error: unknown) => {
    logger.error({ error }, "SSH honeypot server error");
  });

  return sshServer;
};

const startSshHoneypot = () => {
  const sshServer = createSshHoneypotServer();
  sshServer.listen(env.SSH_PORT, env.HOST, () => {
    logger.info(
      {
        environment: env.NODE_ENV,
        host: env.HOST,
        port: env.SSH_PORT,
        ident: env.SSH_IDENT,
      },
      "SSH honeypot listening",
    );
  });

  return sshServer;
};

export { app, logger, startSshHoneypot };
