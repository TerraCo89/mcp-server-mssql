// mcp-server-mssql/src/server.test.ts
// Import individual tool functions instead of the class
import {
    list_tables,
    get_table_schema,
    read_table_rows,
    create_table_records,
    update_table_records,
    delete_table_records
} from './server.js';
// Remove profileManager import
// import * as profileManager from './profileManager.js'; // Add .js
import { logger } from './logger.js'; // Add .js
import * as db from './db.js'; // Add .js
import * as sql from 'mssql'; // Keep external import
// Remove Profile type import
// import { Profile } from './profileManager.js'; // Add .js

// Remove the SDK mock block
// // Mock the @modelcontextprotocol/sdk module - Keep this for now, might be needed later
// jest.mock('@modelcontextprotocol/sdk', () => ({
//   McpServer: jest.fn().mockImplementation(() => ({ // Mock the class constructor
//     start: jest.fn(), // Mock methods if needed by tests (likely not needed if testing tool methods directly)
//     stop: jest.fn(),
//   })),
//   StdioTransport: jest.fn(), // Mock the class constructor
//   mcp: jest.fn(() => (target: any) => target), // Mock decorator/function
//   tool: jest.fn(() => (target: any, propertyKey: string, descriptor: PropertyDescriptor) => descriptor), // Mock decorator/function
//   // McpServerOptions is likely just a type, no runtime mock needed unless used as a value
// }));

// Remove profileManager mock setup
// jest.mock('./profileManager');
// const mockedProfileManager = profileManager as jest.Mocked<typeof profileManager>;

// Mock db module
jest.mock('./db');
const mockedDb = db as jest.Mocked<typeof db>;

// Mock the logger
jest.mock('./logger', () => ({
    logger: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
    }
}));

// --- Mocks for mssql objects ---
// Explicitly type the mock function for query
const mockQueryFn = jest.fn<Promise<sql.IResult<any>>, [string?]>();
const mockBulkFn = jest.fn<Promise<sql.IProcedureResult<any>>, [sql.Table]>(); // Type for bulk

const mockRequest = {
    input: jest.fn().mockReturnThis(), // Chainable
    query: mockQueryFn, // Use the typed mock function
    bulk: mockBulkFn,   // Use the typed mock function
} as unknown as jest.Mocked<sql.Request>;

const mockPool = {
    request: jest.fn().mockReturnValue(mockRequest), // Correct: Return the mock request object
    close: jest.fn().mockResolvedValue(undefined),
    connected: true,
} as unknown as jest.Mocked<sql.ConnectionPool>;
// --- End mssql mocks ---


describe('MSSQL Tool Functions', () => { // Rename describe block
    // Remove serverInstance variable
    // let serverInstance: MssqlServer;

    beforeEach(() => {
        jest.clearAllMocks();
        // Remove serverInstance instantiation
        // serverInstance = new MssqlServer();
        mockedDb.connectToDb.mockResolvedValue(mockPool);
        mockPool.request.mockReturnValue(mockRequest);
        // Reset specific mock function implementations if needed after clearing
        mockQueryFn.mockClear();
        mockBulkFn.mockClear();
        mockRequest.input.mockClear(); // Clear input calls
    });

    // Helper to create a valid mock IRecordSet - Defined once for all tests
    const createMockRecordSet = (records: any[]): sql.IRecordSet<any> => {
        const recordset = records as sql.IRecordSet<any>;
        // Add dummy properties required by the interface
        recordset.columns = {} as any; // Dummy columns object
        recordset.toTable = jest.fn(() => ({} as sql.Table)); // Dummy toTable function
        return recordset;
    };

    // --- Tests for list_tables ---
    describe('list_tables', () => {
        // Remove profile_name from args
        const args = {};
        const argsWithSchema = { schema: 'dbo' };
        // Remove mockPassword and mockProfileData
        // const mockPassword = 'dbPassword';
        // const mockProfileData: Profile = { driver: 'd', server: 's', database: 'db', username: 'u' };

        // Removed duplicate helper function definition
        beforeEach(() => {
            // Remove profile manager mocks
            // mockedProfileManager.loadProfiles.mockResolvedValue({ [args.profile_name]: mockProfileData });
            // mockedProfileManager.getPassword.mockResolvedValue(mockPassword);
            mockQueryFn.mockClear();
            mockRequest.input.mockClear();
        });

        it('should connect to db, query INFORMATION_SCHEMA.TABLES, and return table names', async () => {
            const mockRecordSet = createMockRecordSet([{ TABLE_NAME: 'Table1' }, { TABLE_NAME: 'Table2' }]);
            const mockTableResult: sql.IResult<any> = {
                recordsets: [mockRecordSet], // Use recordsets (plural) array
                recordset: mockRecordSet,   // Keep recordset for convenience if needed, though recordsets is required
                rowsAffected: [2],
                output: {},
            };
            mockQueryFn.mockResolvedValue(mockTableResult);

            // Call the imported function directly
            const result = await list_tables(args);

            // Remove profile manager checks
            // expect(mockedProfileManager.loadProfiles).toHaveBeenCalledTimes(1);
            // expect(mockedProfileManager.getPassword).toHaveBeenCalledWith(args.profile_name);
            // Update connectToDb call check (will be updated further in Step 2)
            expect(mockedDb.connectToDb).toHaveBeenCalledTimes(1); // Check it's called, args check later
            expect(mockPool.request).toHaveBeenCalledTimes(1);
            expect(mockQueryFn).toHaveBeenCalledWith(expect.stringContaining("SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE'"));
            expect(mockQueryFn).toHaveBeenCalledWith(expect.stringContaining("ORDER BY TABLE_NAME;"));
            expect(mockRequest.input).not.toHaveBeenCalled();
            expect(result).toEqual(['Table1', 'Table2']); // Should still extract names correctly
            expect(mockPool.close).toHaveBeenCalledTimes(1);
        });

        it('should include schema filter in query if schema is provided', async () => {
             const mockRecordSet = createMockRecordSet([{ TABLE_NAME: 'TableDbo' }]);
             const mockTableResult: sql.IResult<any> = {
                 recordsets: [mockRecordSet], // Use recordsets (plural) array
                 recordset: mockRecordSet,
                 rowsAffected: [1],
                 output: {}
             };
             mockQueryFn.mockResolvedValue(mockTableResult);

             // Call the imported function directly
             const result = await list_tables(argsWithSchema);

             expect(mockQueryFn).toHaveBeenCalledWith(expect.stringContaining("AND TABLE_SCHEMA = @schema"));
             expect(mockRequest.input).toHaveBeenCalledWith('schema', sql.NVarChar, argsWithSchema.schema);
             expect(result).toEqual(['TableDbo']);
             expect(mockPool.close).toHaveBeenCalledTimes(1);
        });
        // ... other list_tables tests remain the same ...
        // Remove profile/password not found tests for now, will be replaced by env var tests later
        // it('should throw error if profile not found', async () => { ... });
        // it('should throw error if password not found', async () => { ... });

        it('should throw error if connectToDb fails', async () => {
            const connectError = new Error('DB Connect Failed');
            mockedDb.connectToDb.mockRejectedValue(connectError);
            // Call the imported function directly
            await expect(list_tables(args)).rejects.toThrow('DB Connect Failed');
             expect(mockPool.close).not.toHaveBeenCalled();
        });
        it('should throw error if query fails and close pool', async () => {
            const queryError = new Error('SQL Query Failed');
            mockQueryFn.mockRejectedValue(queryError);
            // Call the imported function directly
            await expect(list_tables(args)).rejects.toThrow('SQL Query Failed');
            expect(mockPool.close).toHaveBeenCalledTimes(1);
        });
    });

    describe('get_table_schema', () => {
        // Remove profile_name from args
        const args = { table_name: 'MyTable' };
        const argsWithSchema = { table_name: 'MyTable', schema: 'dbo' };
        // Remove mockPassword and mockProfileData
        // const mockPassword = 'dbPassword';
        // const mockProfileData: Profile = { driver: 'd', server: 's', database: 'db', username: 'u' };
        const mockSchemaResultData = [
            { COLUMN_NAME: 'ID', DATA_TYPE: 'int', IS_NULLABLE: 'NO' },
            { COLUMN_NAME: 'Name', DATA_TYPE: 'nvarchar', IS_NULLABLE: 'YES', CHARACTER_MAXIMUM_LENGTH: 100 },
        ];

        // Renamed helper, using the common one now
        const createMockSchemaResult = (records: any[]): sql.IResult<any> => {
             const mockRecordSet = createMockRecordSet(records); // Use common helper
             return {
                 recordsets: [mockRecordSet],
                 recordset: mockRecordSet,
                 rowsAffected: [records.length],
                 output: {},
             };
         };
        beforeEach(() => {
            // Remove profile manager mocks
            // mockedProfileManager.loadProfiles.mockResolvedValue({ [args.profile_name]: mockProfileData });
            // mockedProfileManager.getPassword.mockResolvedValue(mockPassword);
            mockQueryFn.mockClear();
            mockRequest.input.mockClear();
        });

        it('should connect, query INFORMATION_SCHEMA.COLUMNS, and return schema', async () => {
            const mockResult = createMockSchemaResult(mockSchemaResultData);
            mockQueryFn.mockResolvedValue(mockResult);

            // Call the imported function directly
            const result = await get_table_schema(args);

            // Update connectToDb call check (will be updated further in Step 2)
            expect(mockedDb.connectToDb).toHaveBeenCalledTimes(1); // Check it's called, args check later
            expect(mockPool.request).toHaveBeenCalledTimes(1);
            expect(mockQueryFn).toHaveBeenCalledWith(expect.stringContaining("FROM INFORMATION_SCHEMA.COLUMNS"));
            expect(mockQueryFn).toHaveBeenCalledWith(expect.stringContaining("WHERE TABLE_NAME = @table_name"));
            expect(mockQueryFn).toHaveBeenCalledWith(expect.stringContaining("ORDER BY ORDINAL_POSITION;"));
            expect(mockRequest.input).toHaveBeenCalledWith('table_name', sql.NVarChar, args.table_name);
            expect(mockRequest.input).not.toHaveBeenCalledWith('schema', expect.anything(), expect.anything()); // No schema filter
            expect(result).toEqual(mockSchemaResultData);
            expect(mockPool.close).toHaveBeenCalledTimes(1);
        });

        it('should include schema filter if schema is provided', async () => {
            const mockResult = createMockSchemaResult([{ COLUMN_NAME: 'ID', DATA_TYPE: 'int' }]); // Simplified result
            mockQueryFn.mockResolvedValue(mockResult);

            // Call the imported function directly
            await get_table_schema(argsWithSchema);

            expect(mockQueryFn).toHaveBeenCalledWith(expect.stringContaining("AND TABLE_SCHEMA = @schema"));
            expect(mockRequest.input).toHaveBeenCalledWith('table_name', sql.NVarChar, argsWithSchema.table_name);
            expect(mockRequest.input).toHaveBeenCalledWith('schema', sql.NVarChar, argsWithSchema.schema);
            expect(mockPool.close).toHaveBeenCalledTimes(1);
        });

        // Remove profile/password not found tests for now
        // it('should throw error if profile not found', async () => { ... });
        // it('should throw error if password not found', async () => { ... });

        it('should throw error if connectToDb fails', async () => {
            const connectError = new Error('DB Connect Failed');
            mockedDb.connectToDb.mockRejectedValue(connectError);
            // Call the imported function directly
            await expect(get_table_schema(args)).rejects.toThrow('DB Connect Failed');
            expect(mockPool.close).not.toHaveBeenCalled();
        });

        it('should throw error if query fails and close pool', async () => {
            const queryError = new Error('SQL Schema Query Failed');
            mockQueryFn.mockRejectedValue(queryError);
            // Call the imported function directly
            await expect(get_table_schema(args)).rejects.toThrow('SQL Schema Query Failed');
            expect(mockPool.close).toHaveBeenCalledTimes(1);
        });
    });

    describe('read_table_rows', () => {
        // Remove profile_name from args
        const baseArgs = { table_name: 'Users' };
        // Remove mockPassword and mockProfileData
        // const mockPassword = 'dbPassword';
        // const mockProfileData: Profile = { driver: 'd', server: 's', database: 'db', username: 'u' };
        const mockUserData = [
            { UserID: 1, Name: 'Alice', Age: 30 },
            { UserID: 2, Name: 'Bob', Age: 25 },
            { UserID: 3, Name: 'Charlie', Age: 35 },
        ];

        // Helper to create mock result for row query
        const createMockReadResult = (records: any[]): sql.IResult<any> => {
            const recordset = records as sql.IRecordSet<any>;
            recordset.columns = {} as any; // Dummy
            recordset.toTable = jest.fn(() => ({} as sql.Table)); // Dummy
            return {
                recordsets: [recordset],
                recordset: recordset,
                rowsAffected: [records.length],
                output: {},
            };
        };

        beforeEach(() => {
            // Remove profile manager mocks
            // mockedProfileManager.loadProfiles.mockResolvedValue({ [baseArgs.profile_name]: mockProfileData });
            // mockedProfileManager.getPassword.mockResolvedValue(mockPassword);
            mockQueryFn.mockClear();
            mockRequest.input.mockClear();
            // Default mock query result
            mockQueryFn.mockResolvedValue(createMockReadResult(mockUserData));
        });

        it('should read all columns and rows without filters/pagination', async () => {
            // Call the imported function directly
            const result = await read_table_rows(baseArgs);

            // Update connectToDb call check (will be updated further in Step 2)
            expect(mockedDb.connectToDb).toHaveBeenCalledTimes(1); // Check it's called, args check later
            expect(mockPool.request).toHaveBeenCalledTimes(1);
            expect(mockQueryFn).toHaveBeenCalledWith(expect.stringContaining(`SELECT * FROM [${baseArgs.table_name}]`));
            // Check it doesn't contain WHERE or ORDER BY or OFFSET/FETCH
            expect(mockQueryFn).not.toHaveBeenCalledWith(expect.stringContaining("WHERE"));
            expect(mockQueryFn).not.toHaveBeenCalledWith(expect.stringContaining("ORDER BY"));
            expect(mockQueryFn).not.toHaveBeenCalledWith(expect.stringContaining("OFFSET"));
            expect(result).toEqual(mockUserData);
            expect(mockPool.close).toHaveBeenCalledTimes(1);
        });

        it('should select specific columns', async () => {
            const args = { ...baseArgs, columns: ['UserID', 'Name'] };
            // Call the imported function directly
            await read_table_rows(args);
            expect(mockQueryFn).toHaveBeenCalledWith(expect.stringContaining(`SELECT [UserID], [Name] FROM [${baseArgs.table_name}]`));
        });

        it('should apply simple "=" filter', async () => {
            const args = { ...baseArgs, filters: { Name: { operator: '=', value: 'Alice' } } };
            // Call the imported function directly
            await read_table_rows(args);
            expect(mockQueryFn).toHaveBeenCalledWith(expect.stringContaining(`WHERE [Name] = @filterParam0`));
            expect(mockRequest.input).toHaveBeenCalledWith('filterParam0', 'Alice');
        });

        it('should apply "LIKE" filter', async () => {
            const args = { ...baseArgs, filters: { Name: { operator: 'LIKE', value: 'A%' } } };
            // Call the imported function directly
            await read_table_rows(args);
            expect(mockQueryFn).toHaveBeenCalledWith(expect.stringContaining(`WHERE [Name] LIKE @filterParam0`));
            expect(mockRequest.input).toHaveBeenCalledWith('filterParam0', sql.NVarChar, 'A%');
        });

         it('should apply "IN" filter', async () => {
             const args = { ...baseArgs, filters: { UserID: { operator: 'IN', value: [1, 3] } } };
             // Call the imported function directly
             await read_table_rows(args);
             expect(mockQueryFn).toHaveBeenCalledWith(expect.stringContaining(`WHERE [UserID] IN (@filterParam0_0, @filterParam0_1)`));
             expect(mockRequest.input).toHaveBeenCalledWith('filterParam0_0', 1);
             expect(mockRequest.input).toHaveBeenCalledWith('filterParam0_1', 3);
         });

         it('should apply multiple filters with AND', async () => {
             const args = { ...baseArgs, filters: { Age: { operator: '>', value: 25 }, Name: { operator: 'LIKE', value: 'B%' } } };
             // Call the imported function directly
             await read_table_rows(args);
             // Order might vary, so check for both clauses
             expect(mockQueryFn).toHaveBeenCalledWith(expect.stringContaining(`WHERE [Age] > @filterParam0 AND [Name] LIKE @filterParam1`));
             expect(mockRequest.input).toHaveBeenCalledWith('filterParam0', 25);
             expect(mockRequest.input).toHaveBeenCalledWith('filterParam1', sql.NVarChar, 'B%');
         });

        it('should apply ORDER BY', async () => {
            const args = { ...baseArgs, order_by: { Age: 'DESC' as const, Name: 'ASC' as const } };
            // Call the imported function directly
            await read_table_rows(args);
            expect(mockQueryFn).toHaveBeenCalledWith(expect.stringContaining(`ORDER BY [Age] DESC, [Name] ASC`));
        });

        it('should apply LIMIT and OFFSET (requires ORDER BY)', async () => {
            const args = { ...baseArgs, order_by: { UserID: 'ASC' as const }, limit: 1, offset: 1 };
            // Call the imported function directly
            await read_table_rows(args);
            expect(mockQueryFn).toHaveBeenCalledWith(expect.stringContaining(`ORDER BY [UserID] ASC OFFSET 1 ROWS FETCH NEXT 1 ROWS ONLY`));
        });

         it('should apply default ORDER BY if pagination used without explicit order', async () => {
             const args = { ...baseArgs, limit: 2 };
             // Call the imported function directly
             await read_table_rows(args);
             expect(mockQueryFn).toHaveBeenCalledWith(expect.stringContaining(`ORDER BY (SELECT 1) OFFSET 0 ROWS FETCH NEXT 2 ROWS ONLY`));
             expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('Pagination (limit/offset) used without explicit ORDER BY'));
         });

        it('should handle query errors and close pool', async () => {
            const queryError = new Error('Read Query Failed');
            mockQueryFn.mockRejectedValue(queryError);
            // Call the imported function directly
            await expect(read_table_rows(baseArgs)).rejects.toThrow('Read Query Failed');
            expect(mockPool.close).toHaveBeenCalledTimes(1);
        });

        // Remove profile/password not found tests for now
        // it('should throw error if profile not found', async () => { ... });
        // it('should throw error if password not found', async () => { ... });

         it('should throw error if connectToDb fails', async () => {
             const connectError = new Error('DB Connect Failed');
             mockedDb.connectToDb.mockRejectedValue(connectError);
             // Call the imported function directly
             await expect(read_table_rows(baseArgs)).rejects.toThrow('DB Connect Failed');
             expect(mockPool.close).not.toHaveBeenCalled();
          });
    });

    describe('create_table_records', () => {
        // Remove profile_name from args
        const args = {
            table_name: 'NewUsers',
            records: [
                { Name: 'Dave', Age: 40 },
                { Name: 'Eve', Age: 22 },
            ]
        };
        // Remove mockPassword and mockProfileData
        // const mockPassword = 'dbPassword';
        // const mockProfileData: Profile = { driver: 'd', server: 's', database: 'db', username: 'u' };

        beforeEach(() => {
            // Remove profile manager mocks
            // mockedProfileManager.loadProfiles.mockResolvedValue({ [args.profile_name]: mockProfileData });
            // mockedProfileManager.getPassword.mockResolvedValue(mockPassword);
            mockBulkFn.mockClear(); // Clear bulk mock calls
            mockRequest.input.mockClear(); // Clear any potential input calls if Table used them internally (unlikely)
        });

        it('should connect, build table object, call request.bulk, and return inserted count', async () => {
            // Mock the result object structure expected from request.bulk
            const mockBulkResult = { rowsAffected: args.records.length };
            // Cast to 'any' for mockResolvedValue if type inference struggles with partial mock
            mockBulkFn.mockResolvedValue(mockBulkResult as any);

            // Call the imported function directly
            const result = await create_table_records(args);

            // Update connectToDb call check (will be updated further in Step 2)
            expect(mockedDb.connectToDb).toHaveBeenCalledTimes(1); // Check it's called, args check later
            expect(mockPool.request).toHaveBeenCalledTimes(1);
            // Verify bulk was called with a Table object matching the table name
            expect(mockBulkFn).toHaveBeenCalledWith(expect.objectContaining({
                path: `[${args.table_name}]` // Check table name used in Table object
            }));
            // More detailed check: Verify columns and rows added to the Table object passed to bulk
            const tableArg = mockBulkFn.mock.calls[0][0] as sql.Table; // Get the Table object passed to bulk
            expect(tableArg.columns.length).toBe(2); // Name, Age
            expect(tableArg.columns.find(c => c.name === 'Name')).toBeDefined();
            expect(tableArg.columns.find(c => c.name === 'Age')).toBeDefined();
            expect(tableArg.rows.length).toBe(args.records.length);
            expect(tableArg.rows[0]).toEqual(['Dave', 40]);
            expect(tableArg.rows[1]).toEqual(['Eve', 22]);

            expect(result).toEqual({ status: 'Success', inserted_count: args.records.length });
            expect(mockPool.close).toHaveBeenCalledTimes(1);
        });

        it('should return error if no records are provided', async () => {
            // Call the imported function directly - expect it to throw now
            await expect(create_table_records({ ...args, records: [] })).rejects.toThrow('No records provided to insert.');
            // expect(result).toEqual({ status: 'Error', inserted_count: 0, message: 'No records provided to insert.' });
            expect(mockedDb.connectToDb).not.toHaveBeenCalled();
        });

        it('should handle errors during bulk insert and close pool', async () => {
            const bulkError = new Error('Bulk insert failed');
            mockBulkFn.mockRejectedValue(bulkError);

            // The function now returns the error object instead of throwing for create/update/delete
            // Call the imported function directly - expect it to throw
            await expect(create_table_records(args)).rejects.toThrow('Bulk insert failed');
            // const result = await serverInstance.create_table_records(args);

            expect(mockedDb.connectToDb).toHaveBeenCalledTimes(1);
            expect(mockPool.request).toHaveBeenCalledTimes(1);
            expect(mockBulkFn).toHaveBeenCalledTimes(1);
            // expect(result.status).toBe('Error');
            // expect(result.inserted_count).toBe(0);
            // expect(result.message).toContain('Bulk insert failed'); // Check if error message is included
            expect(mockPool.close).toHaveBeenCalledTimes(1);
        });

        // Remove profile/password not found tests for now
        // it('should return error if profile not found', async () => { ... });
        // it('should return error if password not found', async () => { ... });

         it('should return error if connectToDb fails', async () => {
             const connectError = new Error('DB Connect Failed');
             mockedDb.connectToDb.mockRejectedValue(connectError);
             // Call the imported function directly - expect it to throw
             await expect(create_table_records(args)).rejects.toThrow('DB Connect Failed');
             // const result = await serverInstance.create_table_records(args);
             // expect(result.status).toBe('Error');
             // expect(result.message).toContain('DB Connect Failed');
             expect(mockPool.close).not.toHaveBeenCalled(); // connectToDb failed before pool could be closed
         });
    });

    describe('update_table_records', () => {
        // Remove profile_name from args
        const args = {
            table_name: 'Customers',
            updates: { City: 'New York', Status: 'Active' },
            filters: { CustomerID: 123 }
        };
        // Remove mockPassword and mockProfileData
        // const mockPassword = 'dbPassword';
        // const mockProfileData: Profile = { driver: 'd', server: 's', database: 'db', username: 'u' };

        beforeEach(() => {
            // Remove profile manager mocks
            // mockedProfileManager.loadProfiles.mockResolvedValue({ [args.profile_name]: mockProfileData });
            // mockedProfileManager.getPassword.mockResolvedValue(mockPassword);
            mockQueryFn.mockClear();
            mockRequest.input.mockClear();
        });

        it('should connect, build UPDATE query, execute, and return updated count', async () => {
            // Mock the result for @@ROWCOUNT
            const mockRecordSet = createMockRecordSet([{ RowsAffected: 1 }]); // Use helper
            const mockUpdateResult: sql.IResult<any> = {
                recordsets: [mockRecordSet], // Use helper result
                recordset: mockRecordSet,   // Use helper result
                rowsAffected: [], // Not directly relevant for SELECT @@ROWCOUNT
                output: {},
            };
            mockQueryFn.mockResolvedValue(mockUpdateResult);

            // Call the imported function directly
            const result = await update_table_records(args);

            // Update connectToDb call check (will be updated further in Step 2)
            expect(mockedDb.connectToDb).toHaveBeenCalledTimes(1); // Check it's called, args check later
            expect(mockPool.request).toHaveBeenCalledTimes(1);
            // Check query structure
            expect(mockQueryFn).toHaveBeenCalledWith(expect.stringContaining(`UPDATE [${args.table_name}] SET [City] = @setParam0, [Status] = @setParam1 WHERE [CustomerID] = @filterParam2`));
            expect(mockQueryFn).toHaveBeenCalledWith(expect.stringContaining(`SELECT @@ROWCOUNT AS RowsAffected;`));
            // Check parameter binding
            expect(mockRequest.input).toHaveBeenCalledWith('setParam0', 'New York');
            expect(mockRequest.input).toHaveBeenCalledWith('setParam1', 'Active');
            expect(mockRequest.input).toHaveBeenCalledWith('filterParam2', 123);

            expect(result).toEqual({ status: 'Success', updated_count: 1 });
            expect(mockPool.close).toHaveBeenCalledTimes(1);
        });

        it('should return error if filters are missing or empty', async () => {
            // Call the imported function directly - expect it to throw
            await expect(update_table_records({ ...args, filters: {} })).rejects.toThrow('Filters are required');
            // expect(resultNoFilters.status).toBe('Error');
            // expect(resultNoFilters.message).toContain('Filters are required');
            expect(mockedDb.connectToDb).not.toHaveBeenCalled();

            // Call the imported function directly - expect it to throw
            await expect(update_table_records({ ...args, filters: null as any })).rejects.toThrow('Filters are required');
            // expect(resultNullFilters.status).toBe('Error');
            // expect(resultNullFilters.message).toContain('Filters are required');
            expect(mockedDb.connectToDb).not.toHaveBeenCalled();
        });

        it('should return success with 0 count if updates are missing or empty', async () => {
            // Call the imported function directly
            const resultNoUpdates = await update_table_records({ ...args, updates: {} });
            expect(resultNoUpdates).toEqual({ status: 'Success', updated_count: 0, message: 'No update values provided.' });
            expect(mockedDb.connectToDb).not.toHaveBeenCalled();

            // Call the imported function directly
            const resultNullUpdates = await update_table_records({ ...args, updates: null as any });
            expect(resultNullUpdates).toEqual({ status: 'Success', updated_count: 0, message: 'No update values provided.' });
            expect(mockedDb.connectToDb).not.toHaveBeenCalled();
        });


        it('should handle query errors and close pool', async () => {
            const queryError = new Error('Update Query Failed');
            mockQueryFn.mockRejectedValue(queryError);

            // Call the imported function directly - expect it to throw
            await expect(update_table_records(args)).rejects.toThrow('Update Query Failed');
            // const result = await serverInstance.update_table_records(args);

            expect(mockedDb.connectToDb).toHaveBeenCalledTimes(1);
            expect(mockPool.request).toHaveBeenCalledTimes(1);
            expect(mockQueryFn).toHaveBeenCalledTimes(1);
            // expect(result.status).toBe('Error');
            // expect(result.updated_count).toBe(0);
            // expect(result.message).toContain('Update Query Failed');
            expect(mockPool.close).toHaveBeenCalledTimes(1);
        });

        // Remove profile/password not found tests for now
        // it('should return error if profile not found', async () => { ... });
        // it('should return error if password not found', async () => { ... });

          it('should return error if connectToDb fails', async () => {
              const connectError = new Error('DB Connect Failed');
              mockedDb.connectToDb.mockRejectedValue(connectError);
              // Call the imported function directly - expect it to throw
              await expect(update_table_records(args)).rejects.toThrow('DB Connect Failed');
              // const result = await serverInstance.update_table_records(args);
              // expect(result.status).toBe('Error');
              // expect(result.message).toContain('DB Connect Failed');
              expect(mockPool.close).not.toHaveBeenCalled();
          });
    });

    describe('delete_table_records', () => {
        // Remove profile_name from args
        const args = {
            table_name: 'Logs',
            filters: { LogLevel: 'Error', Timestamp: '2023-10-27' } // Example filters
        };
        // Remove mockPassword and mockProfileData
        // const mockPassword = 'dbPassword';
        // const mockProfileData: Profile = { driver: 'd', server: 's', database: 'db', username: 'u' };

        beforeEach(() => {
            // Remove profile manager mocks
            // mockedProfileManager.loadProfiles.mockResolvedValue({ [args.profile_name]: mockProfileData });
            // mockedProfileManager.getPassword.mockResolvedValue(mockPassword);
            mockQueryFn.mockClear();
            mockRequest.input.mockClear();
        });

        it('should connect, build DELETE query, execute, and return deleted count', async () => {
            // Mock the result for @@ROWCOUNT
            const mockRecordSet = createMockRecordSet([{ RowsAffected: 5 }]); // Use helper
            const mockDeleteResult: sql.IResult<any> = {
                recordsets: [mockRecordSet], // Use helper result
                recordset: mockRecordSet,   // Use helper result
                rowsAffected: [],
                output: {},
            };
            mockQueryFn.mockResolvedValue(mockDeleteResult);

            // Call the imported function directly
            const result = await delete_table_records(args);

            // Update connectToDb call check (will be updated further in Step 2)
            expect(mockedDb.connectToDb).toHaveBeenCalledTimes(1); // Check it's called, args check later
            expect(mockPool.request).toHaveBeenCalledTimes(1);
            // Check query structure
            expect(mockQueryFn).toHaveBeenCalledWith(expect.stringContaining(`DELETE FROM [${args.table_name}] WHERE [LogLevel] = @filterParam0 AND [Timestamp] = @filterParam1`));
            expect(mockQueryFn).toHaveBeenCalledWith(expect.stringContaining(`SELECT @@ROWCOUNT AS RowsAffected;`));
            // Check parameter binding
            expect(mockRequest.input).toHaveBeenCalledWith('filterParam0', 'Error');
            expect(mockRequest.input).toHaveBeenCalledWith('filterParam1', '2023-10-27');

            expect(result).toEqual({ status: 'Success', deleted_count: 5 });
            expect(mockPool.close).toHaveBeenCalledTimes(1);
        });

        it('should return error if filters are missing or empty', async () => {
            // Call the imported function directly - expect it to throw
            await expect(delete_table_records({ ...args, filters: {} })).rejects.toThrow('Filters are required');
            // expect(resultNoFilters.status).toBe('Error');
            // expect(resultNoFilters.message).toContain('Filters are required');
            expect(mockedDb.connectToDb).not.toHaveBeenCalled();

            // Call the imported function directly - expect it to throw
            await expect(delete_table_records({ ...args, filters: null as any })).rejects.toThrow('Filters are required');
            // expect(resultNullFilters.status).toBe('Error');
            // expect(resultNullFilters.message).toContain('Filters are required');
            expect(mockedDb.connectToDb).not.toHaveBeenCalled();
        });

        it('should handle query errors and close pool', async () => {
            const queryError = new Error('Delete Query Failed');
            mockQueryFn.mockRejectedValue(queryError);

            // Call the imported function directly - expect it to throw
            await expect(delete_table_records(args)).rejects.toThrow('Delete Query Failed');
            // const result = await serverInstance.delete_table_records(args);

            expect(mockedDb.connectToDb).toHaveBeenCalledTimes(1);
            expect(mockPool.request).toHaveBeenCalledTimes(1);
            expect(mockQueryFn).toHaveBeenCalledTimes(1);
            // expect(result.status).toBe('Error');
            // expect(result.deleted_count).toBe(0);
            // expect(result.message).toContain('Delete Query Failed');
            expect(mockPool.close).toHaveBeenCalledTimes(1);
        });

        // Remove profile/password not found tests for now
        // it('should return error if profile not found', async () => { ... });
        // it('should return error if password not found', async () => { ... });

          it('should return error if connectToDb fails', async () => {
              const connectError = new Error('DB Connect Failed');
              mockedDb.connectToDb.mockRejectedValue(connectError);
              // Call the imported function directly - expect it to throw
              await expect(delete_table_records(args)).rejects.toThrow('DB Connect Failed');
              // const result = await serverInstance.delete_table_records(args);
              // expect(result.status).toBe('Error');
              // expect(result.message).toContain('DB Connect Failed');
              expect(mockPool.close).not.toHaveBeenCalled();
          });
    });
});