#!/usr/bin/env node

// Import SDK modules needed for the MCP server
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
// Import dotenv for environment variables
import * as dotenv from 'dotenv';
// Load environment variables from .env file
dotenv.config();
// Keep other imports
import sql from 'mssql';
// Removed profileManager imports
import { connectToDb, closePool } from './db.js';

// Check if running in MCP mode
const isMcpMode = process.argv.includes('--stdio');

// Silent logger that doesn't interfere with JSON-RPC over stdio
const logger = {
  info: (msg: string) => {
    if (!isMcpMode) {
      console.info(msg);
    } else if (process.env.DEBUG === 'true') {
      console.error(`[INFO] ${msg}`);
    }
  },
  warn: (msg: string) => {
    if (!isMcpMode) {
      console.warn(msg);
    } else if (process.env.DEBUG === 'true') {
      console.error(`[WARN] ${msg}`);
    }
  },
  error: (msg: string, err?: any) => {
    if (!isMcpMode) {
      console.error(msg, err || '');
    } else if (process.env.DEBUG === 'true') {
      console.error(`[ERROR] ${msg} ${err ? JSON.stringify(err) : ''}`);
    }
  },
  debug: (msg: string) => {
    if (!isMcpMode && process.env.DEBUG === 'true') {
      console.debug(msg);
    } else if (isMcpMode && process.env.DEBUG === 'true') {
      console.error(`[DEBUG] ${msg}`);
    }
  }
};

// Define Tool Argument Schemas
// Removed AddConnectionProfileArgs and ProfileNameArgs interfaces

interface ListTablesArgs {
    schema?: string; // Schema remains optional
}

interface GetTableSchemaArgs {
    table_name: string;
    schema?: string; // Schema remains optional
}

interface ReadTableRowsArgs {
    table_name: string;
    columns?: string[];
    filters?: Record<string, { operator: string; value: any }>;
    limit?: number;
    offset?: number;
    order_by?: Record<string, 'ASC' | 'DESC'>;
}

interface CreateTableRecordsArgs {
    table_name: string;
    records: Record<string, any>[];
}

interface UpdateTableRecordsArgs {
    table_name: string;
    updates: Record<string, any>;
    filters: Record<string, any>;
}

interface DeleteTableRecordsArgs {
    table_name: string;
    filters: Record<string, any>;
}

// Tool schemas for SDK - Profile management tools removed
const toolSchemas = {
    list_tables: {
        type: 'object',
        properties: {
            // profile_name removed
            schema: { type: 'string', nullable: true },
        },
        required: [], // profile_name removed
        title: 'list_tablesArguments'
    },
    get_table_schema: {
        type: 'object',
        properties: {
            // profile_name removed
            table_name: { type: 'string' },
            schema: { type: 'string', nullable: true },
        },
        required: ['table_name'], // profile_name removed
        title: 'get_table_schemaArguments'
    },
    read_table_rows: {
        type: 'object',
        properties: {
            // profile_name removed
            table_name: { type: 'string' },
            columns: { type: 'array', items: { type: 'string' }, nullable: true },
            filters: { type: 'object', additionalProperties: { type: 'object', properties: { operator: { type: 'string' }, value: {} } }, nullable: true },
            limit: { type: 'number', nullable: true },
            offset: { type: 'number', nullable: true },
            order_by: { type: 'object', additionalProperties: { type: 'string', enum: ['ASC', 'DESC'] }, nullable: true },
        },
        required: ['table_name'], // profile_name removed
        title: 'read_table_rowsArguments'
    },
    create_table_records: {
        type: 'object',
        properties: {
            // profile_name removed
            table_name: { type: 'string' },
            records: { type: 'array', items: { type: 'object' } },
        },
        required: ['table_name', 'records'], // profile_name removed
        title: 'create_table_recordsArguments'
    },
    update_table_records: {
        type: 'object',
        properties: {
            // profile_name removed
            table_name: { type: 'string' },
            updates: { type: 'object' },
            filters: { type: 'object' },
        },
        required: ['table_name', 'updates', 'filters'], // profile_name removed
        title: 'update_table_recordsArguments'
    },
    delete_table_records: {
        type: 'object',
        properties: {
            // profile_name removed
            table_name: { type: 'string' },
            filters: { type: 'object' },
        },
        required: ['table_name', 'filters'], // profile_name removed
        title: 'delete_table_recordsArguments'
    }
};

// Tool descriptions for SDK - Profile management descriptions removed
const toolDescriptions = {
    list_tables: `
    Lists user tables available in the connected database (configured via environment variables).

    Args:
        schema: Optional schema name to filter tables by (e.g., 'dbo').

    Returns:
        A list of table names.

    Raises:
        Error: If a database connection or query error occurs.
    `,
    get_table_schema: `
    Retrieves the schema (columns, types, etc.) for a specified table using the environment-configured connection.

    Args:
        table_name: The name of the table.
        schema: Optional schema name to filter tables by (e.g., 'dbo').

    Returns:
        A list of dictionaries describing each column.

    Raises:
        Error: If a database connection or query error occurs, or table name invalid.
    `,
    read_table_rows: `
    Reads rows from a specified table using the environment-configured connection, with advanced filtering.

    Args:
        table_name: The name of the table to read from. Must be a valid SQL identifier.
        columns: Optional list of column names to retrieve. Column names must be valid SQL identifiers.
        filters: Optional dictionary for filtering. Keys are column names (must be valid SQL identifiers).
                 Values are dictionaries specifying the 'operator' and 'value'.
                 Supported operators: '=', '>', '<', '>=', '<=', 'LIKE', 'IN'.
                 For 'IN', the 'value' should be a list.
                 All filters are combined using AND.
                 Example:
                 {
                     "Age": {"operator": ">", "value": 30},
                     "Status": {"operator": "IN", "value": ["Active", "Pending"]},
                     "Name": {"operator": "LIKE", "value": "J%"}
                 }
        limit: Optional maximum number of rows to return. Requires \`order_by\` for reliable pagination.
        offset: Optional number of rows to skip. Requires \`order_by\` for reliable pagination.
        order_by: Optional dictionary for sorting. Keys are column names (must be valid SQL identifiers),
                  values are direction ('ASC' or 'DESC'). Case-insensitive.
                  Example: {"RegistrationDate": "DESC", "Name": "ASC"}
    Returns:
        A list of dictionaries, where each dictionary represents a row. Column names are keys.

    Raises:
        Error: If a database connection or query error occurs, table/column names invalid, filter structure invalid, or unsupported operator used.
    `,
    create_table_records: `
    Inserts one or more new records into the specified table using the environment-configured connection.

    Args:
        table_name: The name of the table to insert into.
        records: A list of dictionaries representing records to insert.

    Returns:
        A dictionary containing the status and the number of records inserted.

    Raises:
        Error: If a database connection or query error occurs, table name invalid, or records list empty/invalid.
    `,
    update_table_records: `
    Updates existing records in the specified table using the environment-configured connection.

    Args:
        table_name: The name of the table to update.
        updates: A dictionary containing the column names and their new values.
        filters: A dictionary of filters to identify the records to update. Requires at least one filter.

    Returns:
        A dictionary containing the status and the number of records updated.

    Raises:
        Error: If a database connection or query error occurs, table name invalid, or updates/filters empty/invalid.
    `,
    delete_table_records: `
    Deletes records from the specified table based on filter criteria using the environment-configured connection.

    Args:
        table_name: The name of the table to delete from.
        filters: A dictionary of filters to identify the records to delete. Requires at least one filter.

    Returns:
        A dictionary containing the status and the number of records deleted.

    Raises:
        Error: If a database connection or query error occurs, table name invalid, or filters empty/invalid.
    `
};

/**
 * Helper function to safely close a connection pool and log errors.
 */
async function closePoolSafely(pool: sql.ConnectionPool | null, context: string): Promise<void> {
    if (pool && pool.connected) {
        try {
            await pool.close();
            logger.info(`Connection pool closed for ${context}.`);
        } catch (closeErr: any) {
            logger.error(`Error closing pool for ${context}:`, closeErr);
        }
    }
}

// Standalone tool functions defined below
// Removed add_connection_profile, list_connection_profiles, remove_connection_profile functions

/**
 * Lists user tables in the database.
 */
export async function list_tables(args: ListTablesArgs): Promise<string[]> {
    logger.debug(`Listing tables, schema: ${args.schema ?? 'all'}`);
    let pool: sql.ConnectionPool | null = null;
    try {
        // Removed profile loading and password retrieval
        pool = await connectToDb(); // Call connectToDb without args
        if (!pool) { // Add null check for type safety
            throw new Error('Database connection pool could not be established.');
        }
        const request = pool.request();
        let query = `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE'`;
        if (args.schema) {
            query += ` AND TABLE_SCHEMA = @schema`;
            request.input('schema', sql.NVarChar, args.schema);
        }
        query += ` ORDER BY TABLE_NAME;`;
        const result = await request.query(query);
        const tableNames = result.recordset.map(row => row.TABLE_NAME);
        logger.debug(`Found tables: ${tableNames.join(', ')}`);
        return tableNames;
    } catch (error: any) {
        logger.error(`Error in list_tables:`, error);
        throw error; // Re-throw the error to be handled by the caller/SDK
    } finally {
        await closePool(pool);
    }
}

/**
 * Retrieves the schema for a specified table.
 */
export async function get_table_schema(args: GetTableSchemaArgs): Promise<Record<string, any>[]> {
    logger.debug(`Getting schema for table: ${args.schema ?? 'default'}.${args.table_name}`);
    let pool: sql.ConnectionPool | null = null;
    try {
        // Removed profile loading and password retrieval
        pool = await connectToDb(); // Call connectToDb without args
        if (!pool) { // Add null check for type safety
            throw new Error('Database connection pool could not be established.');
        }
        const request = pool.request();
        let query = `
            SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, CHARACTER_MAXIMUM_LENGTH, NUMERIC_PRECISION, NUMERIC_SCALE, COLUMN_DEFAULT
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_NAME = @table_name`;
        request.input('table_name', sql.NVarChar, args.table_name);
        if (args.schema) {
            query += ` AND TABLE_SCHEMA = @schema`;
            request.input('schema', sql.NVarChar, args.schema);
        }
        query += ` ORDER BY ORDINAL_POSITION;`;
        const result = await request.query(query);
        logger.debug(`Schema retrieved successfully for table "${args.table_name}"`);
        return result.recordset;
    } catch (error: any) {
        logger.error(`Error in get_table_schema for table "${args.table_name}":`, error);
        throw error; // Re-throw the error
    } finally {
        await closePool(pool);
    }
}

/**
 * Reads rows from a specified table with filtering and pagination.
 */
export async function read_table_rows(args: ReadTableRowsArgs): Promise<Record<string, any>[]> {
    logger.debug(`Reading rows from table: ${args.table_name}`);
    let pool: sql.ConnectionPool | null = null;
    try {
        // Removed profile loading and password retrieval
        pool = await connectToDb(); // Call connectToDb without args
        if (!pool) { // Add null check for type safety
            throw new Error('Database connection pool could not be established.');
        }
        const request = pool.request();

        const selectColumns = args.columns && args.columns.length > 0 ? args.columns.map(c => `[${c}]`).join(', ') : '*';
        let query = `SELECT ${selectColumns} FROM [${args.table_name}]`;

        const filterClauses: string[] = [];
        let paramIndex = 0;
        if (args.filters) {
            for (const col in args.filters) {
                if (Object.prototype.hasOwnProperty.call(args.filters, col)) {
                    const filter = args.filters[col];
                    const paramName = `filterParam${paramIndex++}`;
                    let clause = `[${col}]`;
                    switch (filter.operator.toUpperCase()) {
                        case '=': case '>': case '<': case '>=': case '<=': case '!=': case '<>':
                            clause += ` ${filter.operator} @${paramName}`;
                            request.input(paramName, filter.value);
                            break;
                        case 'LIKE':
                            clause += ` LIKE @${paramName}`;
                            request.input(paramName, sql.NVarChar, filter.value);
                            break;
                        case 'IN':
                            if (Array.isArray(filter.value) && filter.value.length > 0) {
                                const inParams = filter.value.map((val, i) => {
                                    const inParamName = `${paramName}_${i}`;
                                    request.input(inParamName, val);
                                    return `@${inParamName}`;
                                });
                                clause += ` IN (${inParams.join(', ')})`;
                            } else {
                                logger.warn(`Ignoring IN filter for column "${col}" due to invalid value: ${filter.value}`);
                                clause = '';
                            }
                            break;
                        default:
                            logger.warn(`Unsupported filter operator "${filter.operator}" for column "${col}". Ignoring.`);
                            clause = '';
                    }
                    if (clause) filterClauses.push(clause);
                }
            }
        }
        if (filterClauses.length > 0) query += ` WHERE ${filterClauses.join(' AND ')}`;

        const orderClauses: string[] = [];
        if (args.order_by) {
             for (const col in args.order_by) {
                 if (Object.prototype.hasOwnProperty.call(args.order_by, col)) {
                     const direction = args.order_by[col].toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
                     orderClauses.push(`[${col}] ${direction}`);
                 }
             }
        }
         if (orderClauses.length > 0) {
             query += ` ORDER BY ${orderClauses.join(', ')}`;
         } else if (args.limit != null || args.offset != null) {
             logger.warn('Pagination (limit/offset) used without explicit ORDER BY. Ordering by (SELECT 1), which might be inefficient or non-deterministic.');
             query += ` ORDER BY (SELECT 1)`;
         }

        if (args.limit != null || args.offset != null) {
             const offsetCount = args.offset ?? 0;
             query += ` OFFSET ${offsetCount} ROWS`;
             if (args.limit != null && args.limit > 0) {
                 query += ` FETCH NEXT ${args.limit} ROWS ONLY`;
             }
        }
        query += ';';

        logger.debug(`Executing query: ${query}`);
        const result = await request.query(query);
        logger.debug(`Read ${result.recordset.length} rows successfully.`);
        return result.recordset;
    } catch (error: any) {
        logger.error(`Error in read_table_rows for table "${args.table_name}":`, error);
        throw error; // Re-throw the error
    } finally {
        await closePool(pool);
    }
}

/**
 * Inserts one or more new records into the specified table.
 */
export async function create_table_records(args: CreateTableRecordsArgs): Promise<{ status: string; inserted_count: number; message?: string }> {
    logger.debug(`Creating ${args.records.length} records in table: ${args.table_name}`);
    if (!args.records || args.records.length === 0) {
        // Throw error instead of returning object for consistency
        throw new Error('No records provided to insert.');
    }

    let pool: sql.ConnectionPool | null = null;
    try {
        // Removed profile loading and password retrieval
        pool = await connectToDb(); // Call connectToDb without args
        if (!pool) throw new Error('Database connection pool could not be established.');

        const firstRecord = args.records[0];
        const columns = Object.keys(firstRecord);

        // Basic type inference helper
        const getSqlType = (value: any): sql.ISqlType => {
            if (typeof value === 'number') {
                // Call the factory function
                return Number.isInteger(value) ? sql.Int() : sql.Float();
            } else if (typeof value === 'boolean') {
                 // Call the factory function
                return sql.Bit();
            } else if (value instanceof Date) {
                 // Call the factory function
                return sql.DateTime();
            }
            // Default to NVarChar for strings, null, undefined, objects, arrays etc.
            // NVarChar requires length, so sql.MAX is appropriate here.
            return sql.NVarChar(sql.MAX);
        };

        const table = new sql.Table(`[${args.table_name}]`);
        table.create = false; // Assume table exists

        // Define columns based on the first record and inferred types
        columns.forEach(col => {
            // Use type from first record for inference, handle null/undefined safely
            const sampleValue = firstRecord[col];
            const sqlType = getSqlType(sampleValue);
            // Allow nulls for simplicity, could be refined by checking schema
            table.columns.add(col, sqlType, { nullable: true });
        });

        // Add rows
        args.records.forEach(record => {
            const rowValues = columns.map(col => record[col]);
            table.rows.add(...rowValues);
        });

        const request = pool.request();
        const result = await request.bulk(table);

        logger.debug(`Bulk insert successful. ${result.rowsAffected} records inserted into "${args.table_name}".`);
        return { status: 'Success', inserted_count: result.rowsAffected };

    } catch (error: any) {
        logger.error(`Error in create_table_records for table "${args.table_name}":`, error);
        // Re-throw the error for the SDK handler
        throw error;
    } finally {
        await closePool(pool);
    }
}

/**
 * Updates existing records in the specified table.
 */
export async function update_table_records(args: UpdateTableRecordsArgs): Promise<{ status: string; updated_count: number; message?: string }> {
    logger.debug(`Updating records in table: ${args.table_name}`);

    if (!args.filters || Object.keys(args.filters).length === 0) {
        const msg = 'Filters are required for update operations to prevent accidental full table updates.';
        logger.error(`Error in update_table_records for table "${args.table_name}": ${msg}`);
        // Throw error instead of returning object
        throw new Error(msg);
    }
    if (!args.updates || Object.keys(args.updates).length === 0) {
        logger.warn(`No update values provided for table "${args.table_name}". Returning 0 updates.`);
        // Return success object as per original logic, but no profile needed
        return { status: 'Success', updated_count: 0, message: 'No update values provided.' };
    }

    let pool: sql.ConnectionPool | null = null;
    try {
        // Removed profile loading and password retrieval
        pool = await connectToDb(); // Call connectToDb without args
        if (!pool) throw new Error('Database connection pool could not be established.');

        const request = pool.request();
        let paramIndex = 0;

        // Build SET clause
        const setClauses = Object.entries(args.updates).map(([col, value]) => {
            const paramName = `setParam${paramIndex++}`;
            request.input(paramName, value); // Let mssql infer type for updates
            return `[${col}] = @${paramName}`;
        });

        // Build WHERE clause (assuming simple '=' filters)
        const whereClauses = Object.entries(args.filters).map(([col, value]) => {
            const paramName = `filterParam${paramIndex++}`;
            request.input(paramName, value); // Let mssql infer type for filters
            return `[${col}] = @${paramName}`;
        });

        const query = `UPDATE [${args.table_name}] SET ${setClauses.join(', ')} WHERE ${whereClauses.join(' AND ')}; SELECT @@ROWCOUNT AS RowsAffected;`;

        logger.debug(`Executing query: ${query}`);
        const result = await request.query(query);
        const updatedCount = result.recordset[0]?.RowsAffected ?? 0; // @@ROWCOUNT returns result set

        logger.debug(`Update successful. ${updatedCount} records updated in "${args.table_name}".`);
        return { status: 'Success', updated_count: updatedCount };

    } catch (error: any) {
        logger.error(`Error in update_table_records for table "${args.table_name}":`, error);
        // Re-throw the error for the SDK handler
        throw error;
    } finally {
        await closePool(pool);
    }
} // Added missing closing brace

/**
 * Deletes records from the specified table based on filter criteria.
 */
export async function delete_table_records(args: DeleteTableRecordsArgs): Promise<{ status: string; deleted_count: number; message?: string }> {
    logger.debug(`Deleting records from table: ${args.table_name}`);

    if (!args.filters || Object.keys(args.filters).length === 0) {
        const msg = 'Filters are required for delete operations to prevent accidental full table deletion.';
        logger.error(`Error in delete_table_records for table "${args.table_name}": ${msg}`);
        // Throw error instead of returning object
        throw new Error(msg);
    }

    let pool: sql.ConnectionPool | null = null;
    try {
        // Removed profile loading and password retrieval
        pool = await connectToDb(); // Call connectToDb without args
        if (!pool) throw new Error('Database connection pool could not be established.');

        const request = pool.request();
        let paramIndex = 0;

        // Build WHERE clause (assuming simple '=' filters)
        const whereClauses = Object.entries(args.filters).map(([col, value]) => {
            const paramName = `filterParam${paramIndex++}`;
            request.input(paramName, value); // Let mssql infer type for filters
            return `[${col}] = @${paramName}`;
        });

        const query = `DELETE FROM [${args.table_name}] WHERE ${whereClauses.join(' AND ')}; SELECT @@ROWCOUNT AS RowsAffected;`;

        logger.debug(`Executing query: ${query}`);
        const result = await request.query(query);
        const deletedCount = result.recordset[0]?.RowsAffected ?? 0;

        logger.debug(`Delete successful. ${deletedCount} records deleted from "${args.table_name}".`);
        return { status: 'Success', deleted_count: deletedCount };

    } catch (error: any) {
        logger.error(`Error in delete_table_records for table "${args.table_name}":`, error);
        // Re-throw the error for the SDK handler
        throw error;
    } finally {
        await closePool(pool);
    }
}

// --- MCP Server Setup ---

// Map tool names to their implementation functions
const toolImplementations: Record<string, Function> = {
    list_tables,
    get_table_schema,
    read_table_rows,
    create_table_records,
    update_table_records,
    delete_table_records,
};

async function main() {
    try {
        // Debug log - only to stderr
        if (process.env.DEBUG === 'true') {
            logger.error("Starting MSSQL MCP Server in debug mode");
        }

        // Create server
        const server = new Server(
            {
                name: "MSSQL",
                version: "0.1.0",
            },
            {
                capabilities: {
                    tools: {},
                },
            }
        );

        // Register list-tools handler
        server.setRequestHandler(ListToolsRequestSchema, async () => {
            return {
                tools: [
                    {
                        name: "list_tables",
                        description: "Lists all tables in the database",
                        inputSchema: {
                            type: "object",
                            properties: {
                                schema: { type: "string", description: "Database schema name (optional)" }
                            }
                        }
                    },
                    {
                        name: "get_table_schema",
                        description: "Gets the schema of a specific table",
                        inputSchema: {
                            type: "object",
                            properties: {
                                table_name: { type: "string", description: "Name of the table" },
                                schema: { type: "string", description: "Database schema name (optional)" }
                            },
                            required: ["table_name"]
                        }
                    },
                    {
                        name: "read_table_rows",
                        description: "Reads rows from a table with optional filtering and pagination",
                        inputSchema: {
                            type: "object",
                            properties: {
                                table_name: { type: "string", description: "Name of the table" },
                                columns: { 
                                    type: "array", 
                                    items: { type: "string" }, 
                                    description: "Columns to select (optional, defaults to all)" 
                                },
                                filters: { 
                                    type: "object", 
                                    additionalProperties: { 
                                        type: "object", 
                                        properties: { 
                                            operator: { type: "string" }, 
                                            value: {} 
                                        } 
                                    }, 
                                    description: "Filter conditions (optional)" 
                                },
                                limit: { type: "number", description: "Maximum number of rows to return (optional)" },
                                offset: { type: "number", description: "Number of rows to skip (optional)" },
                                order_by: { 
                                    type: "object", 
                                    additionalProperties: { 
                                        type: "string", 
                                        enum: ["ASC", "DESC"] 
                                    }, 
                                    description: "Ordering specification (optional)" 
                                }
                            },
                            required: ["table_name"]
                        }
                    }
                ]
            };
        });

        // Register call-tool handler
        server.setRequestHandler(CallToolRequestSchema, async (request) => {
            try {
                if (!request.params.arguments) {
                    throw new Error("Arguments are required");
                }

                switch (request.params.name) {
                    case "list_tables": {
                        const args = request.params.arguments as Record<string, unknown>;
                        
                        // Create a typed object with only expected properties
                        const typedArgs: ListTablesArgs = { 
                            schema: typeof args.schema === 'string' ? args.schema : undefined
                        };
                        
                        const result = await list_tables(typedArgs);
                        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
                    }

                    case "get_table_schema": {
                        const args = request.params.arguments as Record<string, unknown>;
                        if (typeof args.table_name !== 'string') {
                            throw new Error("table_name is required and must be a string");
                        }
                        
                        const typedArgs: GetTableSchemaArgs = {
                            table_name: args.table_name,
                            schema: typeof args.schema === 'string' ? args.schema : undefined
                        };
                        
                        const result = await get_table_schema(typedArgs);
                        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
                    }

                    case "read_table_rows": {
                        const args = request.params.arguments as Record<string, unknown>;
                        if (typeof args.table_name !== 'string') {
                            throw new Error("table_name is required and must be a string");
                        }
                        
                        // Create a typed object with only expected properties
                        const typedArgs: ReadTableRowsArgs = {
                            table_name: args.table_name,
                            columns: args.columns as string[] | undefined,
                            filters: args.filters as Record<string, { operator: string; value: any }> | undefined,
                            limit: typeof args.limit === 'number' ? args.limit : undefined,
                            offset: typeof args.offset === 'number' ? args.offset : undefined,
                            order_by: args.order_by as Record<string, 'ASC' | 'DESC'> | undefined
                        };
                        
                        const result = await read_table_rows(typedArgs);
                        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
                    }

                    default:
                        throw new Error(`Unknown tool: ${request.params.name}`);
                }
            } catch (error) {
                if (error instanceof Error) {
                    throw new Error(error.message);
                }
                throw new Error('Unknown error occurred');
            }
        });

        // Connect to stdio
        const transport = new StdioServerTransport();
        await server.connect(transport);
        
        if (process.env.DEBUG === 'true') {
            logger.error("MSSQL MCP Server running on stdio");
        }
    } catch (error) {
        if (process.env.DEBUG === 'true') {
            logger.error("Error starting MSSQL MCP server:", error);
        }
        process.exit(1);
    }
}

main().catch((error) => {
    if (process.env.DEBUG === 'true') {
        logger.error("Fatal error running server:", error);
    }
    process.exit(1);
});
