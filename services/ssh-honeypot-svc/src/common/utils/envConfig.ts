import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const envSchema = z.object({
	NODE_ENV: z.enum(["development", "production", "test"]).default("production"),

	HOST: z.string().min(1).default("0.0.0.0"),

	SSH_PORT: z.coerce.number().int().positive().default(2222),

	SSH_IDENT: z.string().min(1).default("SSH-2.0-OpenSSH_8.9p1 Ubuntu-3ubuntu0.6"),

	SSH_AUTH_BANNER: z
		.string()
		.min(1)
		.default("Authorized access only. Activity on this system is monitored and logged."),

	SSH_COMMON_PASSWORDS: z.string().min(1).default("password,123456,qwerty,admin,root,toor,ubuntu,guest,test"),

	EVENT_STORE: z.enum(["memory", "pg"]).default("memory"),

	PG_HOST: z.string().min(1).default("localhost"),

	PG_PORT: z.coerce.number().int().positive().default(5432),

	PG_USER: z.string().min(1).default("postgres"),

	PG_PASSWORD: z.string().default("postgres"),

	PG_DATABASE: z.string().min(1).default("honeypot"),
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
	console.error("Invalid environment variables:", parsedEnv.error.format());
	throw new Error("Invalid environment variables");
}

export const env = {
	...parsedEnv.data,
	isDevelopment: parsedEnv.data.NODE_ENV === "development",
	isProduction: parsedEnv.data.NODE_ENV === "production",
	isTest: parsedEnv.data.NODE_ENV === "test",
};
