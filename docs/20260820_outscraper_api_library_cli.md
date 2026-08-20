# Outscraper API library and CLI

## Goal

Reimplement the complete documented Outscraper Cloud API as a validated TypeScript library and `@stricli/core` CLI, with every endpoint/purpose isolated in its own `src/` subfolder and verified against the live service.

## Decisions

- Treat the official OpenAPI 3.1 document at `https://app.outscraper.cloud/api-docs-data.json` as the endpoint and argument source of truth.
- Follow the `code-style` skill: one export per file, subject-first naming, bounded contexts, Valibot-derived types, and `Result` for all fallible operations.
- Preserve secrets outside tracked files; authenticate from `OUTSCRAPER_API_KEY` and never include key values in output or errors.
- Generate repetitive endpoint source from a checked-in normalized catalog while keeping generated output readable, typed, and independently importable.
- Give each documented operation/purpose a kebab-case folder directly under `src/`; shared transport/configuration and CLI infrastructure live in dedicated shared folders.
- Expose every supported operation through both the package exports and a grouped Stricli command route.

## Approach

- Normalize the OpenAPI operations, parameters, request bodies, and response metadata into deterministic source-generation inputs.
- Build shared request serialization, authentication, response validation, and error conversion first.
- Generate endpoint-local Valibot input schemas, inferred types, Result-returning library functions, and CLI command definitions.
- Add focused generation, transport, endpoint, and CLI tests plus a live authenticated smoke test.

## Tasks

- [x] 1. Add the OpenAPI snapshot/normalizer/generator foundation and prove deterministic generation on a small endpoint fixture.
- [x] 2. Refactor shared client, transport, serialization, response, and error handling to satisfy the Result/Valibot conventions.
- [x] 3. Generate and export a dedicated library folder for every documented Outscraper endpoint/purpose, including full argument validation.
- [x] 4. Add the `@stricli/core` executable and expose every generated endpoint as a validated CLI command.
- [x] 5. Update package metadata and README for library and CLI installation, authentication, usage, and development.
- [x] 6. Add and run unit/integration coverage for generation, all operation schemas, request construction, Result failures, and CLI behavior.
- [x] 7. Copy the Outscraper key from the requested remote environment into the ignored local `.env` and run non-secret live API verification.

## Paths

- `docs/20260820_outscraper_api_library_cli.md`
- `package.json`
- `README.md`
- `scripts/`
- `src/*/`
- `src/index.ts`
- `test/`
- `.env`
