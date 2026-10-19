# Home Renovation API

The NestJS GraphQL API and the report worker. See the [repository README](../README.md) for
setup, the API overview and design decisions.

| Command | What it does |
| --- | --- |
| `pnpm start:dev` | API with reload, on http://localhost:4000/graphql |
| `pnpm worker:dev` | Report worker (run `start:dev` first; it builds `dist/`) |
| `pnpm migration:run` | Applies pending migrations |
| `pnpm migration:generate src/database/migrations/<Name>` | Generates a migration from entity changes |
| `pnpm seed` | Resets the database to the demo data |
| `pnpm test` / `pnpm test:e2e` | Unit tests / e2e tests (need `pnpm infra:up` from the root) |
