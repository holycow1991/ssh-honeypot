CREATE TABLE IF NOT EXISTS ssh_auth_attempts (
	id BIGSERIAL PRIMARY KEY,
	source_ip TEXT NOT NULL,
	source_port INTEGER NOT NULL,
	client_version TEXT NOT NULL,
	username TEXT NOT NULL,
	auth_method TEXT NOT NULL,
	password TEXT,
	attempted_at TIMESTAMPTZ NOT NULL,
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ssh_auth_attempts_attempted_at ON ssh_auth_attempts (attempted_at DESC);
CREATE INDEX IF NOT EXISTS idx_ssh_auth_attempts_username ON ssh_auth_attempts (username);
