# MS SQL Server MCP Server

This project provides an MCP server for interacting with MS SQL Server databases via AI assistants using the Model Context Protocol (MCP).

It uses a secure profile management system leveraging the system's native credential store (via the `keyring` library) to avoid sending passwords over MCP.

## Prerequisites

**For Direct Python Execution:**
-   Python 3.10+
-   Pip (Python package installer)
-   ODBC Driver for SQL Server installed on the machine running the server.
-   `keyring` library dependencies might require system packages (e.g., `dbus-launch`, `gnome-keyring` or `kwallet` on Linux, see `keyring` documentation for details).

**For Docker Execution:**
-   Docker installed and running.
-   The Dockerfile is configured to use the `keyrings.cryptfile` backend for secure password storage within the container's filesystem. This requires mounting a volume for persistence.

## Installation

### Option 1: Direct Python Execution

1.  **Clone the repository (if applicable):**
    ```bash
    git clone <repository_url>
    cd mcp-server-mssql
    ```
2.  **Create and activate a Python virtual environment:**
    ```bash
    python -m venv venv
    # Activate (Windows PowerShell): .\venv\Scripts\Activate.ps1
    # Activate (macOS/Linux): source venv/bin/activate
    ```
3.  **Install dependencies:**
    ```bash
    pip install -r requirements.txt
    ```

### Option 2: Docker Execution

1.  **Clone the repository (if applicable).**
2.  **Build the Docker image:**
    ```bash
    docker build -t mcp-mssql-server .
    ```
    *(Note: The Dockerfile includes ODBC driver installation and configures the `keyrings.cryptfile` backend.)*

## Configuration: Profile Management

This server uses connection profiles to manage database credentials securely.

1.  **Profiles File (`profiles.json`):** Stores non-sensitive details (driver, server, database, username) locally in the server's directory. This file is created automatically if it doesn't exist. **Ensure this file is added to your `.gitignore`**.
2.  **System Keyring:** Passwords are stored securely in your operating system's credential manager (like Windows Credential Manager, macOS Keychain) using the `keyring` library under the service name `mcp-mssql-server`.
3.  **Adding Profiles:** Use the `add_connection_profile` tool. When first adding a profile, you will be prompted **in the terminal where the server is running** to securely enter the password. This password is *never* sent via MCP.
4.  **Managing Profiles:** Use `list_connection_profiles` and `remove_connection_profile` tools.

## Usage

### Option 1: Direct Python Execution (Stdio)

1.  Activate the virtual environment.
2.  Configure in MCP Client Settings (e.g., `mcp_settings.json`):
    ```json
    {
      "mcpServers": {
        // ... other servers ...
        "mssql": {
          "command": "python", // Or full path to venv python
          "args": ["D:/path/to/your/mcp-server-mssql/server.py"],
          "cwd": "D:/path/to/your/mcp-server-mssql",
          "alwaysAllow": [
            "add_connection_profile",
            "list_connection_profiles",
            "remove_connection_profile",
            "read_table_rows",
            "create_table_records",
            "update_table_records",
            "delete_table_records",
            "get_table_schema",
            "list_tables"
          ]
        }
        // ... other servers ...
      }
    }
    ```
    *Adjust paths accordingly.*
3.  Restart your MCP Client/IDE Extension. Add profiles using the `add_connection_profile` tool (requires console interaction for password).

### Option 2: Docker Execution (Stdio)

1.  Ensure the Docker image `mcp-mssql-server` is built.
2.  Configure in MCP Client Settings:
    ```json
    {
      "mcpServers": {
        // ... other servers ...
        "mssql-docker": {
          "command": "docker",
          "args": [
            "run", "-i", "--rm",
            "--env-file", "./mcp-server-mssql/.env_docker", // Example: Store KEYRING_CRYPTFILE_PASSWORD here
            "-v", "mssql_keyring_data:/keyring_data", // Mount volume for keyring data
            "mcp-mssql-server"
          ],
          "alwaysAllow": [
            "add_connection_profile", // Note: Password prompt will appear in container logs
            "list_connection_profiles",
            "remove_connection_profile",
            "read_table_rows",
            "create_table_records",
            "update_table_records",
            "delete_table_records",
            "get_table_schema",
            "list_tables"
          ]
        }
        // ... other servers ...
      }
    }
    ```
3.  Restart your MCP Client/IDE Extension.
4.  **Important:**
    *   The Dockerfile is configured to use the `keyrings.cryptfile` backend. You **MUST** provide a strong password for encrypting the keyring file via the `KEYRING_CRYPTFILE_PASSWORD` environment variable when running the container. It is highly recommended to use a `.env` file (like the example `.env_docker` in the `args`) or Docker secrets, rather than passing the password directly on the command line.
    *   A Docker volume (e.g., `mssql_keyring_data` in the example) **MUST** be mounted to `/keyring_data` inside the container to persist the encrypted keyring file (`keyring_pass.cfg`) and the `profiles.json` file across container restarts.
    *   The `add_connection_profile` password prompt will still appear in the *container's* logs/terminal.

## Available Tools

**Profile Management:**
-   `add_connection_profile(profile_name: str, driver: str, server: str, database: str, username: str)`
-   `list_connection_profiles()`
-   `remove_connection_profile(profile_name: str)`

**Database Operations (Requires `profile_name`):**
-   `read_table_rows(profile_name: str, table_name: str, ...)`
-   `create_table_records(profile_name: str, table_name: str, records: List[Dict])`
-   `update_table_records(profile_name: str, table_name: str, updates: Dict, filters: Dict)`
-   `delete_table_records(profile_name: str, table_name: str, filters: Dict)`
-   `get_table_schema(profile_name: str, table_name: str)`
-   `list_tables(profile_name: str, schema: Optional[str] = None)`

Refer to the docstrings within `server.py` for detailed argument descriptions.

## Example Tool Usage (Conceptual)

1.  **Add a profile (requires console interaction on server):**
    "Using the `mssql` server, call `add_connection_profile` with name `SalesDB_UK`, driver `{ODBC Driver 17 for SQL Server}`, server `myserver.example.com`, database `SalesDB`, username `report_user`." (Then enter password in server console).
2.  **Use the profile:**
    "Using the `mssql` server, call `read_table_rows` using profile `SalesDB_UK` for the table `Customers`. Filter where `Country` is 'UK'."

The AI assistant would construct the second call like:
```json
// Conceptual MCP Tool Call
{
  "tool_name": "read_table_rows",
  "arguments": {
    "profile_name": "SalesDB_UK",
    "table_name": "Customers",
    "filters": {
      "Country": "UK"
    }
  }
}