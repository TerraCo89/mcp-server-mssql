# Project Planning: MS SQL Server MCP Server

## High-Level Vision
Create a robust and secure Model Context Protocol (MCP) server using Python and FastMCP to allow AI assistants (like Claude, GPT-4 within Cursor/Windsurf) to interact directly with an MS SQL Server database.

## Architecture
-   **Language:** Python 3.10+
-   **MCP Framework:** FastMCP
-   **Transport:** Stdio
-   **Database Library:** `pyodbc` (ensure required ODBC drivers for SQL Server are installed on the machine running the server)
-   **Configuration:** Database credentials managed via environment variables.

## Constraints
-   The server must handle connection management securely.
-   Credentials must NOT be hardcoded.
-   Error handling should be implemented for database operations.
-   Tools should be clearly defined with comprehensive descriptions for the LLM.

## Initial Scope (Tools to Implement)
1.  **`read_table_rows`**: Read data from a specified table.
2.  **`create_table_records`**: Insert one or more new records into a specified table.
3.  **`update_table_records`**: Update existing records in a specified table based on filter criteria.
4.  **`delete_table_records`**: Delete records from a specified table based on filter criteria.
5.  **(Optional Future)** `list_tables`: List available tables in the database.
6.  **(Optional Future)** `get_table_schema`: Get the schema (columns, types) for a specific table.

## Technology Stack
-   Python
-   FastMCP
-   pyodbc
-   python-dotenv (for loading environment variables locally)
-   (Testing) pytest, pytest-asyncio, unittest.mock