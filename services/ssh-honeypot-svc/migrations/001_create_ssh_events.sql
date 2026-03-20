CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS ssh_events (
	id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
	event_type TEXT NOT NULL CHECK (event_type IN ('auth_attempt', 'command_execution')),
	source_ip TEXT NOT NULL,
	source_port INTEGER NOT NULL,
	client_version TEXT NOT NULL,
	username TEXT,
	occurred_at TIMESTAMPTZ NOT NULL,
	event_payload JSONB NOT NULL,
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	deleted_at TIMESTAMPTZ NULL
);

CREATE INDEX IF NOT EXISTS idx_ssh_events_occurred_at ON ssh_events (occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_ssh_events_event_type ON ssh_events (event_type);
CREATE INDEX IF NOT EXISTS idx_ssh_events_username ON ssh_events (username);
