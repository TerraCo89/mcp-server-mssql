# PLANNING: MSSQL MCP Server Refactor (Python to JS/TS)

## 1. Goal

Refactor the existing Python-based MSSQL MCP server to JavaScript/TypeScript to resolve Windows compatibility issues, particularly concerning authentication (`keyring`) and configuration file access (`profiles.json`). The new version will replace the Python implementation within this directory (`mcp-server-mssql`).

## 2. Core Requirements

*   Implement a fully functional MCP server using `@modelcontextprotocol/server`.
*   Replicate all 9 existing tools with equivalent functionality.
*   Implement secure profile management for connection details (driver, server, database, username).
*   Implement secure password storage using the native Windows credential store (via `keytar`).
*   Ensure reliable connectivity to MS SQL Server databases.
*   Support configuration via environment variables (e.g., `MCP_PROFILES_DIR`).
*   Prioritize robust operation and testing on Windows.
*   Update documentation (`README.md`) for the new implementation.

## 3. Technology Choices

*   **Language:** TypeScript
*   **Runtime:** Node.js
*   **MCP Framework:** `@modelcontextprotocol/server`
*   **MSSQL Driver:** `mssql`
*   **Secure Credential Storage:** `keytar`
*   **Core Modules:** Node.js `fs`, `path`, `process`

## 4. Implementation Phases

1.  **Setup & Core Functionality:** Initialize project, install dependencies, set up basic server structure, implement core connection and profile/password handling.
2.  **Tool Implementation:** Implement each of the 9 required MCP tools.
3.  **Configuration & Testing:** Adapt environment variable handling, develop tests, and perform thorough testing on Windows (including Docker if applicable).
4.  **Documentation & Cleanup:** Update `README.md`, remove Python artifacts, finalize planning documents, perform code review.

## 5. Key Challenges & Considerations

*   Ensuring `keytar` works reliably across different Windows environments for password storage/retrieval.
*   Mapping `pyodbc` connection parameters and error handling to the `mssql` library.
*   Maintaining compatibility with existing profile storage structure (`profiles.json`) or defining a clear migration path if the structure changes.
*   Updating Docker configuration (`Dockerfile`) if Docker execution remains a requirement.

## 6. Success Criteria

*   The JS/TS server runs successfully on Windows without the previous authentication/config errors.
*   All 9 tools function correctly against an MSSQL database.
*   Connection profiles and passwords are managed securely.
*   The server integrates correctly with the MCP client.
*   The `README.md` accurately reflects the new implementation.