create table if not exists jobs (
    id text primary key,
    url text not null,
    platform text not null,
    status text not null,
    progress integer not null default 0,
    title text,
    thumbnail_url text,
    error text,
    quality text,
    format text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists job_files (
    id bigserial primary key,
    job_id text not null references jobs(id) on delete cascade,
    label text not null,
    storage_key text not null,
    mime_type text not null default 'video/mp4',
    size_bytes bigint,
    created_at timestamptz not null default now()
);

create table if not exists usage_events (
    id bigserial primary key,
    route text not null,
    method text not null,
    actor_ip text,
    status_code integer not null,
    latency_ms integer not null,
    created_at timestamptz not null default now()
);
