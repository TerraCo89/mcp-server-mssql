import os
import pyodbc
import json
import keyring # For secure password storage
import getpass # For securely getting password input
from typing import List, Dict, Any, Optional
# Correct imports based on modelcontextprotocol/python-sdk
from mcp.server.fastmcp import FastMCP
# Removed StdioTransport and ToolContext imports
# Try importing StdioTransport, fallback to default
try:
    from mcp.server.stdio import StdioTransport
except ImportError:
    StdioTransport = None # Will use default if this fails
import asyncio
import logging
from pathlib import Path

# --- Constants ---
PROFILES_FILE = Path(__file__).parent / "profiles.json"
KEYRING_SERVICE_NAME = "mcp-mssql-server" # Service name for keyring

# --- Logging Setup ---
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[logging.StreamHandler()]
)
logger = logging.getLogger(__name__)

# --- Profile Management ---
def load_profiles() -> Dict[str, Dict[str, str]]:
    """Loads connection profiles from profiles.json."""
    if not PROFILES_FILE.exists():
        return {}
    try:
        with open(PROFILES_FILE, 'r') as f:
            return json.load(f)
    except (json.JSONDecodeError, IOError) as e:
        logger.error(f"Error loading profiles from {PROFILES_FILE}: {e}")
        return {}

def save_profiles(profiles: Dict[str, Dict[str, str]]):
    """Saves connection profiles to profiles.json."""
    try:
        with open(PROFILES_FILE, 'w') as f:
            json.dump(profiles, f, indent=2)
    except IOError as e:
        logger.error(f"Error saving profiles file {PROFILES_FILE} (perhaps for profile '{list(profiles.keys())[-1]}'): {e}") # Add context hint
        raise # Re-raise the exception so the caller can handle it

# --- Database Connection ---
def get_db_connection(profile_name: str):
    """
    Retrieves profile details, gets password from keyring, and establishes connection.

    Args:
        profile_name: The name of the connection profile to use.

    Returns:
        pyodbc.Connection: The database connection object.

    Raises:
        ValueError: If profile not found or password not found in keyring.
        pyodbc.Error: If the connection fails.
    """
    profiles = load_profiles()
    profile = profiles.get(profile_name)
    if not profile:
        msg = f"Connection profile '{profile_name}' not found."
        logger.error(msg)
        raise ValueError(msg)

    required_keys = {'driver', 'server', 'database', 'username'}
    missing_keys = required_keys - profile.keys()
    if missing_keys:
        msg = f"Profile '{profile_name}' is missing required keys: {', '.join(missing_keys)}"
        logger.error(msg)
        raise ValueError(msg)

    # Construct keyring username: profile_name + sql_username
    keyring_username = f"{profile_name}:{profile['username']}"
    password = keyring.get_password(KEYRING_SERVICE_NAME, keyring_username)

    if password is None:
        msg = f"Password for profile '{profile_name}' (user: {profile['username']}) not found in keyring service '{KEYRING_SERVICE_NAME}'. Please add the profile again."
        logger.error(msg)
        # Consider prompting again here if running interactively, but for MCP server raise error.
        raise ValueError(msg)

    conn_str_parts = [
        f"DRIVER={profile['driver']}",
        f"SERVER={profile['server']}",
        f"DATABASE={profile['database']}",
        f"UID={profile['username']}",
        f"PWD={password}", # Use password from keyring
        "timeout=30"
    ]
    conn_str = ";".join(conn_str_parts) + ";"

    try:
        conn = pyodbc.connect(conn_str, autocommit=False)
        logger.debug(f"Database connection established using profile '{profile_name}'.")
        return conn
    except pyodbc.Error as ex:
        sqlstate = ex.args[0]
        logger.exception(f"Database connection failed for profile '{profile_name}': SQLSTATE {sqlstate}")
        raise

# --- MCP Server Setup ---
# Initialize FastMCP, trying explicit StdioTransport if found, otherwise default
if StdioTransport:
    mcp = FastMCP(transport=StdioTransport())
    logger.info("Initialized FastMCP with explicit StdioTransport.")
else:
    mcp = FastMCP()
    logger.warning("StdioTransport not found during import attempts. Initializing FastMCP with default transport (expected stdio).")


# --- MCP Tools ---

# --- Profile Management Tools ---

@mcp.tool()
async def add_connection_profile(
    ctx, # Removed ToolContext hint
    profile_name: str,
    driver: str,
    server: str,
    database: str,
    username: str
) -> Dict[str, str]:
    """
    Adds or updates a connection profile. Stores non-sensitive details locally
    and prompts for the password to store securely in the system keyring.
    IMPORTANT: This tool requires interaction on the machine running the server
    to securely input the password when first adding a profile.

    Args:
        ctx: The tool context.
        profile_name: A unique name for this connection profile.
        driver: The exact name of the ODBC driver (e.g., '{ODBC Driver 17 for SQL Server}').
        server: The server address or hostname.
        database: The name of the database.
        username: The SQL Server login username.

    Returns:
        A dictionary indicating success or failure.
    """
    logger.info(f"Attempting to add/update profile: {profile_name}")
    await ctx.send_message(f"Adding/updating profile '{profile_name}'...")

    if not profile_name or not profile_name.isidentifier():
         msg = "Profile name must be a valid identifier (letters, numbers, underscore)."
         logger.error(msg)
         return {"status": "error", "message": msg}

    profiles = load_profiles()
    profile_data = {
        "driver": driver,
        "server": server,
        "database": database,
        "username": username,
    }

    # Construct keyring username: profile_name + sql_username
    keyring_username = f"{profile_name}:{username}"

    try:
        # Prompt for password securely on the server console
        logger.warning(f"Prompting for password for profile '{profile_name}' user '{username}' on server console...")
        await ctx.send_message(f"PASSWORD PROMPT: Please enter password for profile '{profile_name}' user '{username}' in the server's console/terminal.")
        # Use asyncio.to_thread to run blocking getpass in a separate thread
        password = await asyncio.to_thread(getpass.getpass, f"Enter password for profile '{profile_name}' (user: {username}): ")

        if not password:
            msg = "Password cannot be empty."
            logger.error(msg)
            await ctx.send_message(f"ERROR: {msg}")
            return {"status": "error", "message": msg}

        # Store password in keyring
        await asyncio.to_thread(keyring.set_password, KEYRING_SERVICE_NAME, keyring_username, password)
        logger.info(f"Password for profile '{profile_name}' stored securely in keyring.")
        await ctx.send_message("Password received and stored securely.")

        # Store non-sensitive details
        profiles[profile_name] = profile_data
        save_profiles(profiles) # This is synchronous, consider to_thread if it becomes slow
        logger.info(f"Profile '{profile_name}' saved successfully.")
        await ctx.send_message(f"Profile '{profile_name}' added/updated successfully.")
        return {"status": "success", "profile_name": profile_name}

    except IOError as e:
        logger.exception(f"Failed to save profile file for '{profile_name}': {e}")
        await ctx.send_message(f"ERROR: Failed to save profile file: {e}")
        return {"status": "error", "message": f"Failed to save profile file: {e}"}
    except keyring.errors.KeyringError as e: # Use keyring.errors.KeyringError
        logger.exception(f"Keyring error while adding profile '{profile_name}': {e}")
        await ctx.send_message(f"ERROR: Failed to store password securely: {e}")
        return {"status": "error", "message": f"Failed to store password securely: {e}"}
    except Exception as e:
        # Catch any other unexpected errors
        logger.exception(f"Unexpected error while adding profile '{profile_name}': {e}")
        await ctx.send_message(f"ERROR: An unexpected error occurred: {e}")
        return {"status": "error", "message": f"An unexpected error occurred: {e}"}

@mcp.tool()
async def list_connection_profiles(ctx) -> List[str]: # Removed ToolContext hint
    """Lists the names of all saved connection profiles."""
    logger.info("Tool 'list_connection_profiles' called.")
    await ctx.send_message("Listing connection profiles...")
    # This is synchronous, consider to_thread if it becomes slow
    profiles = await asyncio.to_thread(load_profiles)
    profile_names = list(profiles.keys())
    logger.info(f"Found profiles: {profile_names}")
    await ctx.send_message(f"Available profiles: {', '.join(profile_names) if profile_names else 'None'}")
    return profile_names

@mcp.tool()
async def remove_connection_profile(ctx, profile_name: str) -> Dict[str, str]: # Removed ToolContext hint
    """
    Removes a connection profile and its associated password from the keyring.

    Args:
        ctx: The tool context.
        profile_name: The name of the profile to remove.

    Returns:
        A dictionary indicating success or failure.
    """
    logger.info(f"Attempting to remove profile: {profile_name}")
    await ctx.send_message(f"Removing profile '{profile_name}'...")

    # Use to_thread for file I/O
    profiles = await asyncio.to_thread(load_profiles)
    if profile_name not in profiles:
        msg = f"Profile '{profile_name}' not found."
        logger.warning(msg)
        await ctx.send_message(f"Warning: {msg}")
        return {"status": "not_found", "message": msg}

    profile_to_delete = profiles[profile_name]
    username = profile_to_delete.get("username")
    keyring_username = f"{profile_name}:{username}" if username else profile_name # Construct keyring username

    try:
        # Remove non-sensitive details
        del profiles[profile_name]
        await asyncio.to_thread(save_profiles, profiles) # Use to_thread
        logger.info(f"Removed profile details for '{profile_name}' from profiles file.")

        # Remove password from keyring
        try:
            await asyncio.to_thread(keyring.delete_password, KEYRING_SERVICE_NAME, keyring_username) # Use to_thread
            logger.info(f"Password for profile '{profile_name}' (user: {username}) deleted from keyring.")
            await ctx.send_message("Password deleted from secure storage.")
        except keyring.errors.PasswordDeleteError:
            logger.warning(f"Password for profile '{profile_name}' (user: {username}) not found in keyring, but removing profile anyway.")
            await ctx.send_message("Warning: Password not found in secure storage, but profile removed.")

        logger.info(f"Profile '{profile_name}' removed successfully.")
        await ctx.send_message(f"Profile '{profile_name}' removed successfully.")
        return {"status": "success", "profile_name": profile_name}

    except IOError as e:
        logger.exception(f"Failed to update profile file after removing '{profile_name}': {e}")
        await ctx.send_message(f"ERROR: Failed to update profile file: {e}")
        # Profile might be inconsistent (removed from keyring but not file, or vice-versa)
        return {"status": "error", "message": f"Failed to update profile file: {e}. State might be inconsistent."}
    except keyring.errors.KeyringError as e: # Use keyring.errors.KeyringError
        # This case is partially handled above, but catch potential errors during delete itself
        logger.exception(f"Keyring error while removing password for profile '{profile_name}': {e}")
        await ctx.send_message(f"ERROR: Failed to remove password from secure storage: {e}")
        return {"status": "error", "message": f"Failed to remove password from secure storage: {e}"}
    except Exception as e:
        # Catch any other unexpected errors
        logger.exception(f"Unexpected error while removing profile '{profile_name}': {e}")
        await ctx.send_message(f"ERROR: An unexpected error occurred: {e}")
        return {"status": "error", "message": f"An unexpected error occurred: {e}"}


# --- Database Interaction Tools (Refactored) ---

@mcp.tool()
async def read_table_rows(
    ctx, # Removed ToolContext hint
    profile_name: str,
    table_name: str,
    columns: Optional[List[str]] = None,
    filters: Optional[Dict[str, Dict[str, Any]]] = None,
    limit: Optional[int] = None,
    offset: Optional[int] = None,
    order_by: Optional[Dict[str, str]] = None,
) -> List[Dict[str, Any]]:
    """
    Reads rows from a specified table using a saved connection profile, with advanced filtering.

    Args:
        ctx: The tool context.
        profile_name: The name of the saved connection profile to use.
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
        limit: Optional maximum number of rows to return. Requires `order_by` for reliable pagination.
        offset: Optional number of rows to skip. Requires `order_by` for reliable pagination.
        order_by: Optional dictionary for sorting. Keys are column names (must be valid SQL identifiers),
                  values are direction ('ASC' or 'DESC'). Case-insensitive.
                  Example: {"RegistrationDate": "DESC", "Name": "ASC"}
    Returns:
        A list of dictionaries, where each dictionary represents a row. Column names are keys.

    Raises:
        ValueError: If profile not found, profile invalid, table/column names invalid, filter structure invalid, or unsupported operator used.
        pyodbc.Error: If a database error occurs during the query.
    """
    logger.info(f"Tool 'read_table_rows' called for table: {table_name} using profile: {profile_name}")
    await ctx.send_message(f"Reading rows from table '{table_name}' using profile '{profile_name}'...")

    if not table_name.isidentifier():
         logger.error(f"Invalid table name provided: '{table_name}'")
         raise ValueError(f"Invalid table name provided: '{table_name}'")

    safe_columns = []
    if columns:
        for col in columns:
            if not col.isidentifier():
                 logger.error(f"Invalid column name provided: '{col}'")
                 raise ValueError(f"Invalid column name provided: '{col}'")
            safe_columns.append(f"[{col}]")
        select_clause = ", ".join(safe_columns)
    else:
        select_clause = "*"

    params = []
    where_clauses = []
    supported_operators = ['=', '>', '<', '>=', '<=', 'LIKE', 'IN']

    if filters:
        for column, filter_details in filters.items():
            if not column.isidentifier():
                logger.error(f"Invalid filter column name provided: '{column}'")
                raise ValueError(f"Invalid filter column name provided: '{column}'")

            if not isinstance(filter_details, dict) or "operator" not in filter_details or "value" not in filter_details:
                logger.error(f"Invalid filter format for column '{column}'. Expected {{'operator': '...', 'value': ...}}.")
                raise ValueError(f"Invalid filter format for column '{column}'.")

            operator = filter_details["operator"].upper()
            value = filter_details["value"]

            if operator not in supported_operators:
                logger.error(f"Unsupported filter operator '{operator}' for column '{column}'. Supported: {supported_operators}")
                raise ValueError(f"Unsupported filter operator '{operator}'. Supported: {supported_operators}")

            if operator == 'IN':
                if not isinstance(value, list):
                    logger.error(f"Value for 'IN' operator must be a list for column '{column}'. Got: {type(value)}")
                    raise ValueError(f"Value for 'IN' operator must be a list for column '{column}'.")
                if not value:
                    # Handle empty IN list - SQL Server doesn't like IN ()
                    # Option 1: Raise error
                    # raise ValueError(f"Value list for 'IN' operator cannot be empty for column '{column}'.")
                    # Option 2: Add a clause that's always false (safer)
                    where_clauses.append("1 = 0") # This condition will never be met
                    logger.warning(f"Empty list provided for 'IN' operator on column '{column}'. Query will return no results based on this filter.")
                else:
                    placeholders = ", ".join(["?"] * len(value))
                    where_clauses.append(f"[{column}] IN ({placeholders})")
                    params.extend(value)
            else:
                # Standard operators
                where_clauses.append(f"[{column}] {operator} ?")
                params.append(value)
    where_clause = f" WHERE {' AND '.join(where_clauses)}" if where_clauses else ""

    # --- Order By Clause ---
    order_by_clause = ""
    if order_by:
        order_parts = []
        for col, direction in order_by.items():
            if not col.isidentifier():
                logger.error(f"Invalid order_by column name provided: '{col}'")
                raise ValueError(f"Invalid order_by column name provided: '{col}'")
            direction_upper = direction.upper()
            if direction_upper not in ['ASC', 'DESC']:
                logger.error(f"Invalid order_by direction '{direction}' for column '{col}'. Must be 'ASC' or 'DESC'.")
                raise ValueError(f"Invalid order_by direction '{direction}'. Must be 'ASC' or 'DESC'.")
            order_parts.append(f"[{col}] {direction_upper}")
        if order_parts:
            order_by_clause = f" ORDER BY {', '.join(order_parts)}"
    elif limit is not None or offset is not None:
        # SQL Server requires ORDER BY for OFFSET/FETCH - Ensure correct indentation
        order_by_clause = " ORDER BY (SELECT NULL)"
        logger.warning("Using limit/offset without specifying order_by. Pagination results may be unpredictable.")
        await ctx.send_message("Warning: Using limit/offset without specifying order_by. Pagination results may be unpredictable.")


    # --- Pagination Clauses (Require ORDER BY in SQL Server) ---
    offset_clause = ""
    # Add OFFSET clause if offset is specified, or if limit is specified (requires OFFSET 0)
    if offset is not None:
        if not order_by_clause:
             raise ValueError("OFFSET requires an ORDER BY clause.")
        offset_clause = f" OFFSET {int(offset)} ROWS"
    elif limit is not None and order_by_clause: # Add OFFSET 0 if limit is used with ORDER BY, but no explicit offset
        offset_clause = " OFFSET 0 ROWS"

    limit_clause = ""
    if limit is not None:
        if not order_by_clause: # Should theoretically not happen due to above logic, but safety check
             raise ValueError("FETCH NEXT (LIMIT) requires an ORDER BY clause.")
        limit_clause = f" FETCH NEXT {int(limit)} ROWS ONLY"

    # --- Final Query Construction ---
    query = f"SELECT {select_clause} FROM [{table_name}]{where_clause}{order_by_clause}{offset_clause}{limit_clause}"

    logger.info(f"Executing SQL: {query} with params: {params}")
    await ctx.send_message(f"Executing SQL: {query} with params: {params}")

    conn = None
    cursor = None
    try:
        # Use asyncio.to_thread for blocking pyodbc calls
        conn = await asyncio.to_thread(get_db_connection, profile_name)
        cursor = await asyncio.to_thread(conn.cursor)

        logger.info("Executing query...")
        await ctx.send_message("Executing query...")
        await asyncio.to_thread(cursor.execute, query, params)

        # Fetchall might also block, run in thread
        rows = await asyncio.to_thread(cursor.fetchall)
        column_names = [column[0] for column in cursor.description] if cursor.description else []
        result = [dict(zip(column_names, row)) for row in rows]

        logger.info(f"Query successful, fetched {len(result)} rows.")
        await ctx.send_message(f"Query successful, fetched {len(result)} rows.")
        return result

    except (pyodbc.Error, ValueError) as e:
        error_message = f"Error during read_table_rows: {e}"
        if isinstance(e, pyodbc.Error):
             error_message = f"Database query error: SQLSTATE {e.args[0]}, {e}"
        logger.exception(error_message)
        raise

    finally:
        if cursor:
             await asyncio.to_thread(cursor.close)
        if conn:
             await asyncio.to_thread(conn.close)
        logger.info("Database connection closed.")
        await ctx.send_message("Database connection closed.")


@mcp.tool()
async def create_table_records(
    ctx, # Context object (type hint removed)
    profile_name: str,
    table_name: str,
    records: List[Dict[str, Any]]
) -> Dict[str, Any]:
    """
    Inserts one or more new records into the specified table using a saved connection profile.

    Args:
        ctx: The tool context.
        profile_name: The name of the saved connection profile to use.
        table_name: The name of the table to insert into.
        records: A list of dictionaries representing records to insert.

    Returns:
        A dictionary containing the status and the number of records inserted.

    Raises:
        ValueError: If profile not found, profile invalid, table name invalid, or records list empty/invalid.
        pyodbc.Error: If a database error occurs.
    """
    logger.info(f"Tool 'create_table_records' called for table: {table_name} using profile: {profile_name}")

    if not table_name.isidentifier():
         logger.error(f"Invalid table name provided: '{table_name}'")
         raise ValueError(f"Invalid table name: {table_name}")
    if not records:
        logger.error("Attempted to create records with an empty list.")
        raise ValueError("Records list cannot be empty.")

    conn = None
    cursor = None
    inserted_count = 0
    try:
        if not all(records[0].keys() == r.keys() for r in records):
             logger.error("Inconsistent keys found in records list.")
             raise ValueError("All records in the list must have the same keys (columns).")

        columns = list(records[0].keys())
        safe_columns = []
        for col in columns:
            if not col.isidentifier():
                logger.error(f"Invalid column name provided in record keys: '{col}'")
                raise ValueError(f"Invalid column name provided in record keys: '{col}'")
            safe_columns.append(f"[{col}]")

        column_list = ", ".join(safe_columns)
        value_placeholders = ", ".join(["?"] * len(columns))
        query = f"INSERT INTO [{table_name}] ({column_list}) VALUES ({value_placeholders})"

        data_to_insert = [tuple(record[col] for col in columns) for record in records]

        logger.info(f"Executing SQL: {query} with {len(data_to_insert)} records.")
        await ctx.send_message(f"Executing SQL: {query} with {len(data_to_insert)} records.")

        # Use asyncio.to_thread for blocking pyodbc calls
        conn = await asyncio.to_thread(get_db_connection, profile_name)
        cursor = await asyncio.to_thread(conn.cursor)

        await asyncio.to_thread(cursor.executemany, query, data_to_insert)
        inserted_count = len(records)
        await asyncio.to_thread(conn.commit)

        logger.info(f"Insert successful, committed {inserted_count} records.")
        await ctx.send_message(f"Insert successful, committed {inserted_count} records.")
        return {"status": "success", "records_inserted": inserted_count}

    except (pyodbc.Error, ValueError) as e:
        error_message = f"Error during create_table_records: {e}"
        if isinstance(e, pyodbc.Error):
             error_message = f"Database insert error: SQLSTATE {e.args[0]}, {e}"
        logger.exception(error_message)
        if conn:
            try:
                 await asyncio.to_thread(conn.rollback)
                 logger.warning("Transaction rolled back due to error.")
                 await ctx.send_message("Transaction rolled back due to error.")
            except pyodbc.Error as rb_e:
                 logger.error(f"Failed to rollback transaction: {rb_e}")
        raise

    finally:
        if cursor:
             await asyncio.to_thread(cursor.close)
        if conn:
             await asyncio.to_thread(conn.close)
        logger.info("Database connection closed.")
        await ctx.send_message("Database connection closed.")


@mcp.tool()
async def update_table_records(
    ctx, # Context object (type hint removed)
    profile_name: str,
    table_name: str,
    updates: Dict[str, Any],
    filters: Dict[str, Any],
) -> Dict[str, Any]:
    """
    Updates existing records in the specified table using a saved connection profile.

    Args:
        ctx: The tool context.
        profile_name: The name of the saved connection profile to use.
        table_name: The name of the table to update.
        updates: A dictionary containing the column names and their new values.
        filters: A dictionary of filters to identify the records to update. Requires at least one filter.

    Returns:
        A dictionary containing the status and the number of records updated.

    Raises:
        ValueError: If profile not found, profile invalid, table name invalid, or updates/filters empty/invalid.
        pyodbc.Error: If a database error occurs.
    """
    logger.info(f"Tool 'update_table_records' called for table: {table_name} using profile: {profile_name}")

    if not table_name.isidentifier():
         logger.error(f"Invalid table name provided: '{table_name}'")
         raise ValueError(f"Invalid table name: {table_name}")
    if not updates:
        logger.error("Attempted to update records with an empty updates dictionary.")
        raise ValueError("Updates dictionary cannot be empty.")
    if not filters:
        logger.error("Attempted to update records with an empty filters dictionary.")
        raise ValueError("Filters dictionary cannot be empty to prevent accidental mass updates.")

    safe_update_keys = []
    update_params = []
    for key, value in updates.items():
        if not key.isidentifier():
            logger.error(f"Invalid update key provided: '{key}'")
            raise ValueError(f"Invalid update key provided: '{key}'")
        safe_update_keys.append(f"[{key}] = ?")
        update_params.append(value)
    set_clause = ", ".join(safe_update_keys)

    safe_filter_keys = []
    filter_params = []
    for key, value in filters.items():
        if not key.isidentifier():
            logger.error(f"Invalid filter key provided: '{key}'")
            raise ValueError(f"Invalid filter key provided: '{key}'")
        safe_filter_keys.append(f"[{key}] = ?")
        filter_params.append(value)
    where_clause = f" WHERE {' AND '.join(safe_filter_keys)}"

    query = f"UPDATE [{table_name}] SET {set_clause}{where_clause}"
    params = update_params + filter_params

    logger.info(f"Executing SQL: {query} with params: {params}")
    await ctx.send_message(f"Executing SQL: {query} with params: {params}")

    conn = None
    cursor = None
    updated_count = 0
    try:
        # Use asyncio.to_thread for blocking pyodbc calls
        conn = await asyncio.to_thread(get_db_connection, profile_name)
        cursor = await asyncio.to_thread(conn.cursor)

        await asyncio.to_thread(cursor.execute, query, params)
        updated_count = cursor.rowcount if cursor.rowcount != -1 else 0 # Handle potential -1 rowcount
        await asyncio.to_thread(conn.commit)

        logger.info(f"Update successful, committed changes affecting {updated_count} records.")
        await ctx.send_message(f"Update successful, committed changes affecting {updated_count} records.")
        return {"status": "success", "records_updated": updated_count}

    except (pyodbc.Error, ValueError) as e:
        error_message = f"Error during update_table_records: {e}"
        if isinstance(e, pyodbc.Error):
             error_message = f"Database update error: SQLSTATE {e.args[0]}, {e}"
        logger.exception(error_message)
        if conn:
            try:
                 await asyncio.to_thread(conn.rollback)
                 logger.warning("Transaction rolled back due to error.")
                 await ctx.send_message("Transaction rolled back due to error.")
            except pyodbc.Error as rb_e:
                 logger.error(f"Failed to rollback transaction: {rb_e}")
        raise

    finally:
        if cursor:
             await asyncio.to_thread(cursor.close)
        if conn:
             await asyncio.to_thread(conn.close)
        logger.info("Database connection closed.")
        await ctx.send_message("Database connection closed.")


@mcp.tool()
async def delete_table_records(
    ctx, # Context object (type hint removed)
    profile_name: str,
    table_name: str,
    filters: Dict[str, Any],
) -> Dict[str, Any]:
    """
    Deletes records from the specified table based on filter criteria using a saved connection profile.

    Args:
        ctx: The tool context.
        profile_name: The name of the saved connection profile to use.
        table_name: The name of the table to delete from.
        filters: A dictionary of filters to identify the records to delete. Requires at least one filter.

    Returns:
        A dictionary containing the status and the number of records deleted.

    Raises:
        ValueError: If profile not found, profile invalid, table name invalid, or filters empty/invalid.
        pyodbc.Error: If a database error occurs.
    """
    logger.info(f"Tool 'delete_table_records' called for table: {table_name} using profile: {profile_name}")

    if not table_name.isidentifier():
         logger.error(f"Invalid table name provided: '{table_name}'")
         raise ValueError(f"Invalid table name: {table_name}")
    if not filters:
        logger.error("Attempted to delete records with an empty filters dictionary.")
        raise ValueError("Filters dictionary cannot be empty to prevent accidental mass deletes.")

    safe_filter_keys = []
    filter_params = []
    for key, value in filters.items():
        if not key.isidentifier():
            logger.error(f"Invalid filter key provided: '{key}'")
            raise ValueError(f"Invalid filter key provided: '{key}'")
        safe_filter_keys.append(f"[{key}] = ?")
        filter_params.append(value)
    where_clause = f" WHERE {' AND '.join(safe_filter_keys)}"

    query = f"DELETE FROM [{table_name}]{where_clause}"
    params = filter_params

    logger.info(f"Executing SQL: {query} with params: {params}")
    await ctx.send_message(f"Executing SQL: {query} with params: {params}")

    conn = None
    cursor = None
    deleted_count = 0
    try:
        # Use asyncio.to_thread for blocking pyodbc calls
        conn = await asyncio.to_thread(get_db_connection, profile_name)
        cursor = await asyncio.to_thread(conn.cursor)

        await asyncio.to_thread(cursor.execute, query, params)
        deleted_count = cursor.rowcount if cursor.rowcount != -1 else 0 # Handle potential -1 rowcount
        await asyncio.to_thread(conn.commit)

        logger.info(f"Delete successful, committed changes affecting {deleted_count} records.")
        await ctx.send_message(f"Delete successful, committed changes affecting {deleted_count} records.")
        return {"status": "success", "records_deleted": deleted_count}

    except (pyodbc.Error, ValueError) as e:
        error_message = f"Error during delete_table_records: {e}"
        if isinstance(e, pyodbc.Error):
             error_message = f"Database delete error: SQLSTATE {e.args[0]}, {e}"
        logger.exception(error_message)
        if conn:
            try:
                 await asyncio.to_thread(conn.rollback)
                 logger.warning("Transaction rolled back due to error.")
                 await ctx.send_message("Transaction rolled back due to error.")
            except pyodbc.Error as rb_e:
                 logger.error(f"Failed to rollback transaction: {rb_e}")
        raise

    finally:
        if cursor:
             await asyncio.to_thread(cursor.close)
        if conn:
             await asyncio.to_thread(conn.close)
        logger.info("Database connection closed.")
        await ctx.send_message("Database connection closed.")


@mcp.tool()
async def get_table_schema(
    ctx, # Context object (type hint removed)
    profile_name: str,
    table_name: str,
    schema: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """
    Retrieves the schema (columns, types, etc.) for a specified table using a saved connection profile.

    Args:
        ctx: The tool context.
        profile_name: The name of the saved connection profile to use.
        table_name: The name of the table.
        schema: Optional schema name to filter tables by (e.g., 'dbo').

    Returns:
        A list of dictionaries describing each column.

    Raises:
        ValueError: If profile not found, profile invalid, or table name invalid.
        pyodbc.Error: If a database error occurs.
    """
    logger.info(f"Tool 'get_table_schema' called for table: {table_name} using profile: {profile_name}")

    if not table_name.isidentifier():
         logger.error(f"Invalid table name provided: '{table_name}'")
         raise ValueError(f"Invalid table name: {table_name}")
    if schema and not schema.isidentifier():
         logger.error(f"Invalid schema name provided: '{schema}'")
         raise ValueError(f"Invalid schema name: {schema}")

    conn = None
    cursor = None
    try:
        # Use asyncio.to_thread for blocking pyodbc calls
        conn = await asyncio.to_thread(get_db_connection, profile_name)
        cursor = await asyncio.to_thread(conn.cursor)

        logger.info(f"Fetching schema for table '{table_name}' (schema: {schema or 'default'})...")
        await ctx.send_message(f"Fetching schema for table '{table_name}' (schema: {schema or 'default'})...")

        # Fetch schema using cursor.columns
        # Note: The exact columns returned by cursor.columns can vary by driver/DB
        columns_info = await asyncio.to_thread(cursor.columns, table=table_name, schema=schema)

        schema_result = []
        # Standard column indices based on ODBC spec (may vary slightly)
        # 3: TABLE_NAME, 4: COLUMN_NAME, 5: DATA_TYPE (numeric), 6: TYPE_NAME,
        # 7: COLUMN_SIZE, 9: DECIMAL_DIGITS, 11: IS_NULLABLE ('YES'/'NO')
        for col in columns_info:
            schema_result.append({
                "table_name": col[2],
                "column_name": col[3],
                "data_type_code": col[4],
                "type_name": col[5],
                "column_size": col[6],
                "decimal_digits": col[8],
                "is_nullable": col[10] == 'YES',
                # Add more fields if needed from the col tuple
            })

        logger.info(f"Schema fetched successfully for table '{table_name}'. Found {len(schema_result)} columns.")
        await ctx.send_message(f"Schema fetched successfully for table '{table_name}'. Found {len(schema_result)} columns.")
        return schema_result

    except (pyodbc.Error, ValueError) as e:
        error_message = f"Error during get_table_schema: {e}"
        if isinstance(e, pyodbc.Error):
             error_message = f"Database schema fetch error: SQLSTATE {e.args[0]}, {e}"
        logger.exception(error_message)
        raise

    finally:
        if cursor:
             await asyncio.to_thread(cursor.close)
        if conn:
             await asyncio.to_thread(conn.close)
        logger.info("Database connection closed.")
        await ctx.send_message("Database connection closed.")


@mcp.tool()
async def list_tables(
    ctx, # Context object (type hint removed)
    profile_name: str,
    schema: Optional[str] = None,
) -> List[str]:
    """
    Lists user tables available in the connected database using a saved connection profile.

    Args:
        ctx: The tool context.
        profile_name: The name of the saved connection profile to use.
        schema: Optional schema name to filter tables by (e.g., 'dbo').

    Returns:
        A list of table names.

    Raises:
        ValueError: If profile not found or profile invalid.
        pyodbc.Error: If a database error occurs.
    """
    logger.info(f"Tool 'list_tables' called for schema: {schema or 'default'} using profile: {profile_name}")

    if schema and not schema.isidentifier():
         logger.error(f"Invalid schema name provided: '{schema}'")
         raise ValueError(f"Invalid schema name: {schema}")

    conn = None
    cursor = None
    try:
        # Use asyncio.to_thread for blocking pyodbc calls
        conn = await asyncio.to_thread(get_db_connection, profile_name)
        cursor = await asyncio.to_thread(conn.cursor)

        logger.info(f"Fetching tables for schema '{schema or 'default'}'...")
        await ctx.send_message(f"Fetching tables for schema '{schema or 'default'}'...")

        # Fetch tables using cursor.tables
        tables_info = await asyncio.to_thread(cursor.tables, schema=schema, tableType='TABLE')

        table_names = [row.table_name for row in tables_info]

        logger.info(f"Found {len(table_names)} tables in schema '{schema or 'default'}'.")
        await ctx.send_message(f"Found {len(table_names)} tables in schema '{schema or 'default'}'.")
        return table_names

    except (pyodbc.Error, ValueError) as e:
        error_message = f"Error during list_tables: {e}"
        if isinstance(e, pyodbc.Error):
             error_message = f"Database list tables error: SQLSTATE {e.args[0]}, {e}"
        logger.exception(error_message)
        raise

    finally:
        if cursor:
             await asyncio.to_thread(cursor.close)
        if conn:
             await asyncio.to_thread(conn.close)
        logger.info("Database connection closed.")
        await ctx.send_message("Database connection closed.")


# --- Main Execution ---
if __name__ == "__main__":
    logger.info("Starting MS SQL Server MCP Server...")
    # Ensure profiles file exists (create if not)
    if not PROFILES_FILE.exists():
        logger.info(f"Profiles file '{PROFILES_FILE}' not found, creating empty file.")
        save_profiles({}) # Create an empty profiles file

    # Run the MCP server
    try:
        asyncio.run(mcp.run())
    except KeyboardInterrupt:
        logger.info("Server stopped by user.")
    except Exception as e:
        logger.exception(f"An unexpected error occurred during server execution: {e}")