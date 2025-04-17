import sql from 'mssql';
// Removed Profile import as it's no longer needed
import { logger } from './logger.js'; // Add .js

// Consider connection pooling strategy: global pool vs. pool per profile vs. connection per request
// Global pool might be simplest if connection details don't change often per server instance.
// For now, let's define a function to create a connection pool on demand.

/**
 * Creates and connects an MSSQL connection pool based on environment variables.
 * @returns A connected sql.ConnectionPool instance.
 * @throws Error if connection fails.
 */
export async function connectToDb(): Promise<sql.ConnectionPool> {
    // Read connection details from environment variables
    const host = process.env.MSSQL_HOST;
    const user = process.env.MSSQL_USER;
    const password = process.env.MSSQL_PASSWORD;
    const database = process.env.MSSQL_DATABASE;
    const portEnv = process.env.MSSQL_PORT;
    const encryptEnv = process.env.MSSQL_ENCRYPT;
    const trustServerCertificateEnv = process.env.MSSQL_TRUST_SERVER_CERTIFICATE;
    const driver = process.env.MSSQL_DRIVER; // Optional driver

    // Validate required environment variables
    if (!host || !user || !password || !database) {
        const missing = [
            !host && 'MSSQL_HOST',
            !user && 'MSSQL_USER',
            !password && 'MSSQL_PASSWORD',
            !database && 'MSSQL_DATABASE',
        ].filter(Boolean).join(', ');
        logger.error(`Missing required environment variables: ${missing}`);
        throw new Error(`Missing required environment variables: ${missing}`);
    }

    // Parse optional environment variables with defaults
    const port = portEnv ? parseInt(portEnv, 10) : 1433;
    if (isNaN(port)) {
        logger.error(`Invalid MSSQL_PORT: ${portEnv}. Must be a number.`);
        throw new Error(`Invalid MSSQL_PORT: ${portEnv}. Must be a number.`);
    }

    // Parse encrypt and trustServerCertificate settings
    const encrypt = encryptEnv ? encryptEnv.toLowerCase() === 'true' : false; // Default to false for dev
    const trustServerCertificate = trustServerCertificateEnv ? trustServerCertificateEnv.toLowerCase() === 'true' : true; // Default to true for dev

    logger.info(`Using connection settings: encrypt=${encrypt}, trustServerCertificate=${trustServerCertificate}`);

    const config: sql.config = {
        user: user,
        password: password,
        server: host,
        port: port,
        database: database,
        ...(driver && { driver: driver }), // Conditionally add driver if provided
        options: {
            encrypt: encrypt,
            trustServerCertificate: trustServerCertificate,
            enableArithAbort: true
        },
        pool: {
            max: 10, // Example pool configuration
            min: 0,
            idleTimeoutMillis: 30000
        }
    };

    logger.info(`Attempting to connect to database: ${database} on server: ${host}:${port} as user: ${user}`);

    try {
        // The ConnectionPool constructor now automatically handles the connection attempt upon instantiation
        // if you provide the config directly. Or use pool.connect() explicitly.
        const pool = new sql.ConnectionPool(config);
        const poolConnection = await pool.connect(); // Explicitly connect
        logger.info(`Successfully connected to database: ${database}`);

        poolConnection.on('error', err => {
            logger.error('SQL Pool Error:', err);
            // Handle pool errors, potentially try to reconnect or terminate
        });

        return poolConnection;
    } catch (err: any) {
        logger.error(`Database connection failed for server: ${host}:${port}, database: ${database}, user: ${user}`, err);
        throw new Error(`Database connection failed: ${err.message}`);
    }
}

// Optional: Function to safely close a pool
export async function closePool(pool: sql.ConnectionPool | null): Promise<void> {
    if (pool && pool.connected) {
        try {
            await pool.close();
            logger.info('Database connection pool closed.');
        } catch (err) {
            logger.error('Error closing database connection pool:', err);
        }
    }
}