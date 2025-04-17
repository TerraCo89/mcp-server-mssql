# TASKS: MSSQL MCP Server Refactor (Python to JS/TS)

## Phase 1: Setup & Core Functionality

*   [x] **Task 1.1:** Initialize Node.js project: `npm init -y`, create `tsconfig.json`. (package.json generated, tsconfig.json created)
*   [x] **Task 1.2:** Install dependencies: `npm install @modelcontextprotocol/server mssql keytar typescript @types/node @types/mssql @types/keytar --save-dev`. (Dependencies listed in created package.json)
*   [x] **Task 1.3:** Implement basic MCP server structure (`src/server.ts` or `src/index.ts`) using `@modelcontextprotocol/server`, handling stdin/stdout communication. (Basic structure and tool definitions created in src/server.ts)
*   [x] **Task 1.4:** Implement MSSQL connection function using `mssql` library, handling connection pooling and errors. (Function structure defined in src/db.ts)
*   [x] **Task 1.5:** Implement profile loading/saving logic:
    *   [x] Read/write `profiles.json` (respecting `MCP_PROFILES_DIR`).
    *   [x] Define TypeScript interfaces for profile structure. (Implemented in src/profileManager.ts)
*   [x] **Task 1.6:** Implement secure password handling:
    *   [x] Use `keytar` to set/get/delete passwords associated with profile names.
    *   [x] Handle potential `keytar` errors gracefully. (Functions defined with try/catch in src/profileManager.ts)
*   [x] **Initial Tool Definitions:** Define the 9 MCP tools with signatures, types, and JSDoc in `src/server.ts`. (Completed in src/server.ts)
*   [x] **.gitignore Update:** Updated for Node.js/TypeScript project. (Completed)
*   [x] **.env.example Update:** Updated for Node.js/TypeScript project. (Completed)

## Phase 2: Tool Implementation

*   [x] **Task 2.1:** Implement `add_connection_profile` tool:
    *   Accept profile details.
    *   Save non-sensitive data to `profiles.json`.
    *   Prompt for password (interactively if possible, or require separate secure setup step) and store using `keytar`.
*   [x] **Task 2.2:** Implement `list_connection_profiles` tool:
    *   Read profile names from `profiles.json`.
*   [x] **Task 2.3:** Implement `remove_connection_profile` tool:
    *   Remove profile from `profiles.json`.
    *   Delete associated password using `keytar`.
*   [x] **Task 2.4:** Implement `list_tables` tool:
    *   Connect to DB using profile.
    *   Query system tables (e.g., `INFORMATION_SCHEMA.TABLES`).
    *   Handle optional schema filtering.
*   [x] **Task 2.5:** Implement `get_table_schema` tool:
    *   Connect to DB using profile.
    *   Query system tables (e.g., `INFORMATION_SCHEMA.COLUMNS`).
    *   Format schema information.
*   [x] **Task 2.6:** Implement `read_table_rows` tool:
    *   Connect to DB using profile.
    *   Build dynamic SQL query based on `table_name`, `columns`, `filters`, `order_by`, `limit`, `offset`.
    *   Parameterize inputs to prevent SQL injection.
    *   Execute query and format results.
*   [x] **Task 2.7:** Implement `create_table_records` tool:
    *   Connect to DB using profile.
    *   Build dynamic `INSERT` statement(s).
    *   Parameterize inputs.
    *   Execute statement(s) and report success/failure.
*   [x] **Task 2.8:** Implement `update_table_records` tool:
    *   Connect to DB using profile.
    *   Build dynamic `UPDATE` statement with `SET` and `WHERE` clauses.
    *   Parameterize inputs.
    *   Execute statement and report rows affected.
*   [x] **Task 2.9:** Implement `delete_table_records` tool:
    *   Connect to DB using profile.
    *   Build dynamic `DELETE` statement with `WHERE` clause.
    *   Parameterize inputs.
    *   Execute statement and report rows affected.

## Phase 3: Configuration & Testing

*   [x] **Task 3.1:** Implement handling for `MCP_PROFILES_DIR` environment variable to determine `profiles.json` location. (Implemented in src/profileManager.ts)
*   [ ] **Task 3.2:** Develop basic tests (e.g., using Jest or similar):
    *   Test profile management functions (add, list, remove).
    *   Test database connection logic.
    *   Test basic tool functionality (mocking DB interaction where necessary).
*   [ ] **Task 3.3:** Perform manual testing on a Windows machine:
    *   Verify profile creation and password storage/retrieval via Windows Credential Manager.
    *   Test all tools against a live MSSQL instance.
    *   Test with and without `MCP_PROFILES_DIR` set.
*   [ ] **Task 3.4:** (Optional) Update `Dockerfile` if Docker execution is still required:
    *   Install Node.js and necessary build tools.
    *   Copy project files.
    *   Install dependencies (`npm install`).
    *   Set up entry point (`node dist/server.js`).
    *   Address potential `keytar` issues within the container (may require alternative storage or configuration).
    *   Test the Docker image.

## Phase 4: Documentation & Cleanup

*   [x] **Task 4.1 (Preliminary):** Update `README.md`:
    *   Change language references from Python to JS/TS.
    *   Update prerequisites (Node.js, npm).
    *   Update installation instructions (`npm install`).
    *   Update configuration details (mentioning `keytar`, `mssql`).
    *   Update usage instructions (Node.js execution command, MCP client settings).
    *   Update Docker instructions if applicable. (Full update pending Phase 3)
*   [ ] **Task 4.2:** Remove Python artifacts: `server.py`, `requirements.txt`, `__pycache__`, `venv` (if present).
*   [x] **Task 4.3:** Create/Update `PLANNING.md` and `TASKS.md` in the repository (This task). (Updated TASKS.md)
*   [ ] **Task 4.4:** Perform final code review, linting, and cleanup.