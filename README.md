# MCP Server for Microsoft SQL Server (Node.js/TypeScript)

This project provides a Model Context Protocol (MCP) server that allows AI agents to interact with Microsoft SQL Server databases. This version is implemented in Node.js and TypeScript.

## Features

*   Connects directly to a single MSSQL database instance configured via environment variables.
*   Provides tools for:
    *   Listing tables (`list_tables`).
    *   Retrieving table schemas (`get_table_schema`).
    *   Performing CRUD operations (`read_table_rows`, `create_table_records`, `update_table_records`, `delete_table_records`).

## Prerequisites

*   Node.js (v18 or later recommended)
*   npm (usually comes with Node.js)
*   Access to a Microsoft SQL Server instance.
*   Necessary MSSQL ODBC drivers installed on the machine running the server.

## Installation

1.  Clone the repository:
    ```bash
    git clone <repository-url>
    cd mcp-server-mssql
    ```
2.  Install dependencies:
    ```bash
    npm install
    ```

## Configuration

1.  **Environment Variables:** Configuration is handled entirely through environment variables.
    *   Copy `.env.example` to `.env`.
    *   Fill in the required MSSQL connection details:
        *   `MSSQL_HOST`
        *   `MSSQL_PORT` (defaults to 1433 if not set)
        *   `MSSQL_USER`
        *   `MSSQL_PASSWORD`
        *   `MSSQL_DATABASE`
    *   Optionally configure other MSSQL options (`MSSQL_DRIVER`, `MSSQL_ENCRYPT`, `MSSQL_TRUST_SERVER_CERTIFICATE`) and logging (`LOG_LEVEL`) as described in `.env.example`.

## Usage

1.  **Build the TypeScript code:**
    ```bash
    npm run build
    ```
2.  **Run the server:**
    ```bash
    npm start
    ```
    Alternatively, for development:
    ```bash
    npm run dev
    ```
3.  **Connect via MCP Client:** Configure your MCP client (e.g., Roo) to connect to this server using stdio.

## Tools

*(Detailed descriptions of the tools can be found in the server's `ListTools` response)*

*   `list_tables`
*   `get_table_schema`
*   `read_table_rows`
*   `create_table_records`
*   `update_table_records`
*   `delete_table_records`

## Development

*(Add details about running tests, linting, etc. later)*

## License

[MIT] - *(Or your chosen license)*