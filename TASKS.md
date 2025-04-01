# Project Tasks: MS SQL Server MCP Server

## Completed Tasks (2025-04-01)
-   [x] Create initial project structure (folders, `__init__.py`)
-   [x] Set up Python virtual environment (`venv`)
-   [x] Create `requirements.txt` with initial dependencies (mcp, pyodbc, python-dotenv, pytest, pytest-asyncio, keyring)
-   [x] Create `server.py` with basic MCP setup using `mcp` library.
-   [x] Implement `read_table_rows` tool (Refactored for profiles).
-   [x] Implement `create_table_records` tool (Refactored for profiles).
-   [x] Implement `update_table_records` tool (Refactored for profiles).
-   [x] Implement `delete_table_records` tool (Refactored for profiles).
-   [x] Implement `get_table_schema` tool (Refactored for profiles).
-   [x] Implement `list_tables` tool (Refactored for profiles).
-   [x] Implement secure connection handling using profiles (`profiles.json` + `keyring`).
-   [x] Add profile management tools (`add_connection_profile`, `list_connection_profiles`, `remove_connection_profile`).
-   [x] Add basic error handling and logging.
-   [x] Write comprehensive docstrings and descriptions for all tools.
-   [x] Create `README.md` with setup, profile usage, and Docker instructions.
-   [x] Configure `.gitignore`.
-   [x] Add unit tests for all tools using `pytest` (split into `test_profile_management.py` and `test_db_tools.py`).
-   [x] Create `Dockerfile` for deployment.
-   [-] Removed `.env.example` as env vars are no longer used for connection.
-   [x] Fixed unit tests related to mocking `pathlib.Path.exists` and `asyncio.to_thread` (2025-04-01).

## Upcoming Tasks / Backlog
-   [x] Add more detailed unit tests for profile management tools (edge cases, error handling) (2025-04-01).
-   [ ] Add more robust error handling throughout (e.g., specific exceptions, detailed logging) (Partially addressed 2025-04-01).
-   [x] Refine Dockerfile for secure keyring backend integration (e.g., using volumes or secrets) (2025-04-01).
-   [x] Implement more advanced filtering in `read_table_rows` (>, <, LIKE, IN) (2025-04-01).
-   [x] Add `order_by` parameter to `read_table_rows` for reliable pagination (2025-04-01).

## Discovered During Work
-   `apply_diff` tool struggles with large or multi-part changes after partial applications.
-   `write_to_file` can fail due to content length limits.
-   Need to be careful with imports from the `mcp` library (`ToolContext` is implicit).
# Removed as these were addressed by refactoring mocks