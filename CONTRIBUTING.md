# Contributing to BrewBar POS

Thanks for your interest in contributing! This guide covers everything you need to get started.

## Development Setup

**Prerequisites:** [.NET 10 SDK](https://dotnet.microsoft.com/download), [Node.js 20+](https://nodejs.org/)

```bash
git clone https://github.com/Sharkywrecks/BrewBarPOS.git
cd BrewBarPOS

# Start the API with SQLite (no MySQL needed for development)
npm run dev:api:sqlite

# In another terminal
cd client
npm install
npx ng serve pos      # POS app → http://localhost:4201
npx ng serve admin    # Admin app → http://localhost:4200
```

### Default Login Credentials

| Role | PIN | Email | Password |
|------|-----|-------|----------|
| Admin | 1234 | admin@brewbar.local | Admin123! |
| Cashier | 0000 | cashier@brewbar.local | Cashier123! |

## Project Structure

- `server/src/BrewBar.Core/` — Domain entities, interfaces, enums (no external dependencies)
- `server/src/BrewBar.Infrastructure/` — EF Core, repositories, services
- `server/src/BrewBar.API/` — Controllers, DTOs, middleware
- `client/projects/pos/` — POS terminal Angular app
- `client/projects/admin/` — Admin dashboard Angular app
- `client/libs/` — Shared libraries (api-client, auth, ui, sync, printing)

See [`.github/copilot-instructions.md`](.github/copilot-instructions.md) for the full project map and architecture details.

## Code Conventions

### Backend (.NET)

- Clean Architecture: Core has zero dependencies, Infrastructure implements Core interfaces, API is the HTTP layer
- Controllers delegate to services — keep controllers thin
- Use `ServiceResult<T>` for service return types
- EF Core with the Unit of Work / Repository pattern
- xUnit + FluentAssertions + Moq for tests

### Frontend (Angular)

- Standalone components (no NgModules)
- Angular signals for state management
- Angular Material 3 for UI components
- Vitest for unit tests
- NSwag-generated API client — never hand-write HTTP calls

## Running Tests

```bash
# Backend unit tests
dotnet test server/tests/BrewBar.Tests.Unit/

# Backend integration tests (requires MySQL via Docker)
docker compose up -d
dotnet test server/tests/BrewBar.Tests.Integration/

# Frontend tests
cd client
npx ng test --watch=false

# Lint
cd client
npx ng lint
```

## Regenerating the API Client

After changing any controller or DTO:

```bash
cd client
npm run generate    # runs NSwag against the .NET API
```

This regenerates `client/libs/api-client/src/lib/generated/client.api.ts`.

## Branch Naming

- `feature/short-description` — new features
- `fix/short-description` — bug fixes
- `chore/short-description` — tooling, CI, dependencies

## Pull Requests

1. Branch from `main`
2. Keep PRs focused — one feature or fix per PR
3. Ensure all tests pass (`dotnet test` and `ng test`)
4. Ensure lint passes (`ng lint`)
5. Write a clear PR description explaining **what** and **why**

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).
