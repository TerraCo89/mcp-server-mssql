# MSSQL MCP Server Redesign Plan

**created_At:** 2025-04-17T08:54:59+10:00  
**updated_At:** 2025-04-18T09:32:12+10:00  
**last_read_at:** 2025-04-18T09:32:12+10:00  

---

## Objective

Redesign the MSSQL MCP server to remove the multi-profile system and use environment variable-based configuration for all environments. Each server instance will represent a single DB connection, configured via environment variables.

---

## Plan & Checklist

### 1. Remove the Multi-Profile System

- [x] Delete `profileManager.ts`, `profiles.json`, and all code/tests that reference or depend on profiles. (Confirmed `profileManager.ts`/`.json` already gone, deleted `profileManager.test.ts`, removed profile tests from `server.test.ts`)
- [x] Remove all tool functions and schemas related to profile management: (Confirmed functions gone from `server.ts`, removed tests from `server.test.ts`)
  - `add_connection_profile`
  - `list_connection_profiles`
  - `remove_connection_profile`
- [x] Update all tool argument schemas and function signatures to remove `profile_name` and profile-related fields. (Confirmed schemas updated in `server.ts`, removed from test args)

### 2. Refactor DB Connection Logic

- [x] Update `db.ts` to read connection details from environment variables:
  - `MSSQL_HOST`
  - `MSSQL_PORT`
  - `MSSQL_USER`
  - `MSSQL_PASSWORD`
  - `MSSQL_DATABASE`
  - (Optionally) `MSSQL_ENCRYPT`, `MSSQL_TRUST_SERVER_CERTIFICATE`
- [x] Refactor `connectToDb` to use these env vars directly, and remove the `Profile` and `password` arguments.
- [x] Create a single pool at server startup and reuse it for all requests, or create on demand from env vars.

### 3. Refactor Tool Functions

- [x] Update all tool functions in `server.ts` to:
  - Remove `profile_name` from arguments.
  - Use the env-based connection (no profile lookup, no password retrieval).
  - Simplify error handling (no profile/password errors).
- [x] Update tool schemas and descriptions to reflect the new argument structure.

### 4. Update Configuration and Documentation

- [x] Update `.env.example`: Remove `MCP_PROFILES_DIR`, add all required MSSQL env vars with comments.
- [x] Update `README.md`: Setup and usage instructions for env-based configuration and single-DB-per-server model.
- [x] Remove any documentation or comments referencing profiles or multi-profile logic.

### 5. Testing and Validation

- [x] Update/remove all tests that depend on profiles. (Removed profile tests from `server.test.ts`, updated `db.test.ts` to remove profile logic/add env mocks)
- [ ] Add tests for env-based connection logic and tool functions.
- [ ] Manual testing of all tool functions.

### 6. Finalization

- [x] Final code review and cleanup.
- [x] Final README and Dockerfile update.
- [ ] (Optional) Add migration/upgrade notes for existing users.

---

## Architecture Diagram

```mermaid
flowchart TD
    subgraph Environment Variables
        A[MSSQL_HOST]
        B[MSSQL_PORT]
        C[MSSQL_USER]
        D[MSSQL_PASSWORD]
        E[MSSQL_DATABASE]
    end
    subgraph MCP Server
        F[db.ts: connectToDb()]
        G[server.ts: tool functions]
    end
    A & B & C & D & E --> F
    F --> G
    G -->|CRUD| SQL[(SQL Server)]
```

---

## Notes from Previous Work

- Project is ESM, `server.ts` refactoring partially complete.
- Build is currently broken due to incomplete refactor.
- Remaining work includes: finishing refactor, fixing build/test issues, manual testing, code cleanup, and documentation.

---

## Timestamps

- **created_At:** 2025-04-17T08:54:59+10:00
- **updated_At:** 2025-04-18T09:32:12+10:00
- **last_read_at:** 2025-04-18T09:32:12+10:00

---

## Progress Summary (2025-04-18)

### Previously Completed:
- Confirmed `profileManager.ts` and `profiles.json` were already deleted.
- Deleted obsolete `profileManager.test.ts`.
- Removed profile management test suites from `server.test.ts`.
- Refactored remaining tests in `server.test.ts` to remove `profile_name` and profile manager mocks.
- Renamed `jest.config.js` to `jest.config.cjs` to fix ESM module scope error.
- Updated `jest.config.cjs` to use ESM preset and added `moduleNameMapper`.
- Updated `db.test.ts` to remove `Profile` import and mock required environment variables.

### Newly Completed:
- Updated `db.ts` to read connection details exclusively from environment variables.
- Refactored all tool functions in `server.ts` to remove profile references and use env-based connections.
- Updated tool schemas and descriptions to reflect the new argument structure.
- Uncommented the SDK imports and main function in `server.ts`.
- Completely rewrote the Dockerfile to use Node.js instead of Python and removed profile-related configurations.
- Updated README.md and .env.example to document the environment variable-based configuration.

### Remaining Work:
- Add tests for env-based connection logic and tool functions.
- Perform manual testing of all tool functions.
- Potentially add migration/upgrade notes for existing users.
- Address the issue with Jest failing to parse `@modelcontextprotocol/sdk` (SyntaxError: Cannot use import statement outside a module).