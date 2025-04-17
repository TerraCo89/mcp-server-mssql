// Import SDK modules needed for the MCP server
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequest, ListToolsRequest } from "@modelcontextprotocol/sdk/types.js"; // Import actual types
// Keep other imports
import * as sql from 'mssql';
// Removed profileManager imports
import { connectToDb } from './db.js';
import { logger } from './logger.js';

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
    logger.info(`Listing tables, schema: ${args.schema ?? 'all'}`);
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
        logger.info(`Found tables: ${tableNames.join(', ')}`);
        return tableNames;
    } catch (error: any) {
        logger.error(`Error in list_tables:`, error);
        throw error; // Re-throw the error to be handled by the caller/SDK
    } finally {
        await closePoolSafely(pool, `list_tables`); // Removed profile name from context
    }
}

/**
 * Retrieves the schema for a specified table.
 */
export async function get_table_schema(args: GetTableSchemaArgs): Promise<Record<string, any>[]> {
    logger.info(`Getting schema for table: ${args.schema ?? 'default'}.${args.table_name}`);
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
        logger.info(`Schema retrieved successfully for table "${args.table_name}"`);
        return result.recordset;
    } catch (error: any) {
        logger.error(`Error in get_table_schema for table "${args.table_name}":`, error);
        throw error; // Re-throw the error
    } finally {
        await closePoolSafely(pool, `get_table_schema table "${args.table_name}"`); // Removed profile name
    }
}

/**
 * Reads rows from a specified table with filtering and pagination.
 */
export async function read_table_rows(args: ReadTableRowsArgs): Promise<Record<string, any>[]> {
    logger.info(`Reading rows from table: ${args.table_name}`);
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
        logger.info(`Read ${result.recordset.length} rows successfully.`);
        return result.recordset;
    } catch (error: any) {
        logger.error(`Error in read_table_rows for table "${args.table_name}":`, error);
        throw error; // Re-throw the error
    } finally {
        await closePoolSafely(pool, `read_table_rows table "${args.table_name}"`); // Removed profile name
    }
}

/**
 * Inserts one or more new records into the specified table.
 */
export async function create_table_records(args: CreateTableRecordsArgs): Promise<{ status: string; inserted_count: number; message?: string }> {
    logger.info(`Creating ${args.records.length} records in table: ${args.table_name}`);
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

        logger.info(`Bulk insert successful. ${result.rowsAffected} records inserted into "${args.table_name}".`);
        return { status: 'Success', inserted_count: result.rowsAffected };

    } catch (error: any) {
        logger.error(`Error in create_table_records for table "${args.table_name}":`, error);
        // Re-throw the error for the SDK handler
        throw error;
    } finally {
        await closePoolSafely(pool, `create_table_records table "${args.table_name}"`); // Removed profile name
    }
}

/**
 * Updates existing records in the specified table.
 */
export async function update_table_records(args: UpdateTableRecordsArgs): Promise<{ status: string; updated_count: number; message?: string }> {
    logger.info(`Updating records in table: ${args.table_name}`);

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

        logger.info(`Update successful. ${updatedCount} records updated in "${args.table_name}".`);
        return { status: 'Success', updated_count: updatedCount };

    } catch (error: any) {
        logger.error(`Error in update_table_records for table "${args.table_name}":`, error);
        // Re-throw the error for the SDK handler
        throw error;
    } finally {
        await closePoolSafely(pool, `update_table_records table "${args.table_name}"`); // Removed profile name
    }
} // Added missing closing brace

/**
 * Deletes records from the specified table based on filter criteria.
 */
export async function delete_table_records(args: DeleteTableRecordsArgs): Promise<{ status: string; deleted_count: number; message?: string }> {
    logger.info(`Deleting records from table: ${args.table_name}`);

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

        logger.info(`Delete successful. ${deletedCount} records deleted from "${args.table_name}".`);
        return { status: 'Success', deleted_count: deletedCount };

    } catch (error: any) {
        logger.error(`Error in delete_table_records for table "${args.table_name}":`, error);
        // Re-throw the error for the SDK handler
        throw error;
    } finally {
        await closePoolSafely(pool, `delete_table_records table "${args.table_name}"`); // Removed profile name
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
    logger.info('Starting MSSQL MCP Server...');

    // Initialize the connection pool at startup (optional, could also connect per request)
    let mainPool: sql.ConnectionPool | null = null;
    try {
        mainPool = await connectToDb();
        logger.info('Initial database connection pool established.');
    } catch (error) {
        logger.error('Failed to establish initial database connection pool. Server cannot start.', error); // Use logger.error
        process.exit(1); // Exit if initial connection fails
    }

    // Ensure the pool is closed gracefully on exit
    process.on('exit', async () => {
        logger.info('Closing main database connection pool on exit.');
        await closePoolSafely(mainPool, 'server exit');
    });
    process.on('SIGINT', async () => { // Handle Ctrl+C
        logger.info('Received SIGINT, shutting down...');
        process.exit(0);
    });
    process.on('SIGTERM', async () => { // Handle termination signal
        logger.info('Received SIGTERM, shutting down...');
        process.exit(0);
    });


    // Correct Server constructor: new Server(transport, handlers)
    const transport = new StdioServerTransport();
    const handlers = {
        // Handler for ListTools request
        async ListTools(request: ListToolsRequest) { 
            logger.info('Received ListTools request');
            return {
                tools: Object.keys(toolSchemas).map(toolName => ({
                    name: toolName,
                    description: toolDescriptions[toolName as keyof typeof toolDescriptions] || 'No description available.',
                    inputSchema: toolSchemas[toolName as keyof typeof toolSchemas]
                }))
            };
        },
        // Handler for CallTool request
        async CallTool(request: CallToolRequest) {
            // Correctly destructure toolName and input from request.params
            const { name: toolName, arguments: input } = request.params;
            logger.info(`Received CallTool request for: ${toolName}`);
            logger.debug(`Tool input: ${JSON.stringify(input)}`);

            const toolFunction = toolImplementations[toolName];

            if (!toolFunction) {
                logger.error(`Tool not found: ${toolName}`);
                throw new Error(`Tool not found: ${toolName}`);
            }

            try {
                // Execute the tool function with the provided input (arguments)
                // Ensure input is passed correctly, handle undefined if necessary
                const result = await toolFunction(input ?? {}); // Pass empty object if input is undefined
                logger.info(`Tool ${toolName} executed successfully.`);
                logger.debug(`Tool output: ${JSON.stringify(result)}`);
                return { output: result };
            } catch (error: any) {
                logger.error(`Error executing tool ${toolName}:`, error);
                // Rethrow the error so the SDK can format it correctly for the client
                throw error;
            }
        }
    };

    // Create MCP server instance
    const serverInfo = {
        name: 'mcp-server-mssql',
        version: '0.1.0', // TODO: Get version from package.json dynamically
    };
    const serverOptions = {
        transport: transport,
        handlers: handlers,
        logger: logger,
        // Add required capabilities object with correct structure
        capabilities: {
            tools: {}, // Indicate tool support with an empty object
            logging: {} // Indicate logging support with an empty object
            // Add other capabilities as needed (e.g., resources: {}, prompts: {})
        }
    };
    const server = new Server(serverInfo, serverOptions);

    logger.info('MSSQL MCP Server started and listening.');
    // The server transport handles the main loop implicitly
}

// Start the server
main().catch(error => {
    logger.error('Unhandled error during server startup:', error); // Use logger.error
    process.exit(1);
});
