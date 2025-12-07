# OneLedger CI/CD & Environments (MVP)

## Environments
- **Local**: Developer machines; run services with mocks/dev dependencies; seeded dev data.
- **Dev**: Shared integration env; feature branches can deploy for integration testing; permissive data.
- **Staging**: Production-like; release candidates only; stable data and configs; used for UAT/smoke/perf sanity.
- **Prod**: Live tenant data; staged rollouts/blue-green or canary where feasible.

## CI Pipeline (per service and shared libs)
1) **Lint/Format**: enforce code style.
2) **Unit Tests**: required for merge (auth, membership, payments/billing, events, communications, config-center, shared lib).
3) **Build**: compile/bundle service or shared lib artifact; produce container image.
4) **Basic API Tests (Smoke)**: lightweight happy-path for key endpoints using ephemeral env or mocked deps.
5) **Image Scan**: dependency and container scan.
6) **Publish Artifact/Image**: tag with commit SHA.

## CD Flow
- **Dev deploys**: on main merges; automatic to Dev.
- **Staging deploys**: manual or promoted from Dev artifacts; run smoke/UAT checks post-deploy.
- **Prod deploys**: manual approval; blue-green or canary; rollback via previous image.

## Testing Gates (minimum for merge)
- Unit tests must pass for core services and shared lib.
- Basic API smoke tests must pass (auth login/refresh, membership register/approve, payments create payment, invoices send, events create/publish/register, communications send broadcast/reminder).
- Lint/format must pass.

## Health/Monitoring Wiring
- **Health endpoints**: `/health` (liveness), `/status` (readiness) scraped by K8s probes and monitoring.
- **Logs**: structured JSON with trace/tenant IDs; shipped to log stack; alert on error rates.
- **Metrics**: service latency/error rate, request volumes; business KPIs (payments success, invoice aging, registrations); exposed via Prometheus-compatible endpoints/sidecars.
- **Tracing**: distributed tracing enabled on gateway and services; sampled in prod with burst on error.

## Rollback & Release Hygiene
- Rollback: redeploy previous image; DB migrations are forward-only and gated (use safe migrations).
- Release notes: summarize changes, services touched, migrations, known risks.

## Secrets & Config
- Managed per environment (e.g., Vault/Secrets Manager); never in code. Tenant configs stay in Config Center.

