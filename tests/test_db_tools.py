import pytest
import pyodbc
from unittest.mock import patch, MagicMock, AsyncMock

# Import the functions to be tested
from server import (
    read_table_rows, create_table_records, update_table_records,
    delete_table_records, get_table_schema, list_tables
)

# Fixtures are automatically discovered from conftest.py

# --- Tests for Database Tools (Using Profiles) ---

@pytest.mark.asyncio
@patch('server.get_db_connection')
async def test_read_table_rows_uses_profile(
    mock_get_conn: MagicMock,
    mock_tool_context: AsyncMock,
    mock_db_connection: tuple,
    sample_profile_name: str,
    # Fixtures for file/keyring are implicitly used by get_db_connection mock target
):
    """Tests that read_table_rows calls get_db_connection with profile name."""
    mock_conn, mock_cursor = mock_db_connection
    mock_get_conn.return_value = mock_conn
    mock_cursor.fetchall.return_value = [(1,)]
    mock_cursor.description = [('id', int)]

    await read_table_rows(
        ctx=mock_tool_context,
        profile_name=sample_profile_name, # Use profile name
        table_name="users",
        filters={} # Pass empty filter dict to match new signature
    )

    mock_get_conn.assert_called_once_with(sample_profile_name)
    mock_cursor.execute.assert_called_once() # Basic check, details tested elsewhere if needed


@pytest.mark.asyncio
@patch('server.get_db_connection')
async def test_create_table_records_uses_profile(
    mock_get_conn: MagicMock,
    mock_tool_context: AsyncMock,
    mock_db_connection: tuple,
    sample_profile_name: str,
):
    """Tests that create_table_records calls get_db_connection with profile name."""
    mock_conn, mock_cursor = mock_db_connection
    mock_get_conn.return_value = mock_conn
    records = [{"colA": 1}]

    await create_table_records(
        ctx=mock_tool_context,
        profile_name=sample_profile_name,
        table_name="new_table",
        records=records
    )

    mock_get_conn.assert_called_once_with(sample_profile_name)
    mock_cursor.executemany.assert_called_once()
    mock_conn.commit.assert_called_once()


@pytest.mark.asyncio
@patch('server.get_db_connection')
async def test_update_table_records_uses_profile(
    mock_get_conn: MagicMock,
    mock_tool_context: AsyncMock,
    mock_db_connection: tuple,
    sample_profile_name: str,
):
    """Tests that update_table_records calls get_db_connection with profile name."""
    mock_conn, mock_cursor = mock_db_connection
    mock_get_conn.return_value = mock_conn
    mock_cursor.rowcount = 1
    updates = {"colA": 2}
    filters = {"id": 5}

    await update_table_records(
        ctx=mock_tool_context,
        profile_name=sample_profile_name,
        table_name="items",
        updates=updates,
        filters=filters
    )

    mock_get_conn.assert_called_once_with(sample_profile_name)
    mock_cursor.execute.assert_called_once()
    mock_conn.commit.assert_called_once()


@pytest.mark.asyncio
@patch('server.get_db_connection')
async def test_delete_table_records_uses_profile(
    mock_get_conn: MagicMock,
    mock_tool_context: AsyncMock,
    mock_db_connection: tuple,
    sample_profile_name: str,
):
    """Tests that delete_table_records calls get_db_connection with profile name."""
    mock_conn, mock_cursor = mock_db_connection
    mock_get_conn.return_value = mock_conn
    mock_cursor.rowcount = 1
    filters = {"id": 5}

    await delete_table_records(
        ctx=mock_tool_context,
        profile_name=sample_profile_name,
        table_name="old_items",
        filters=filters
    )

    mock_get_conn.assert_called_once_with(sample_profile_name)
    mock_cursor.execute.assert_called_once()
    mock_conn.commit.assert_called_once()


@pytest.mark.asyncio
@patch('server.get_db_connection')
async def test_get_table_schema_uses_profile(
    mock_get_conn: MagicMock,
    mock_tool_context: AsyncMock,
    mock_db_connection: tuple,
    sample_profile_name: str,
):
    """Tests that get_table_schema calls get_db_connection with profile name."""
    mock_conn, mock_cursor = mock_db_connection
    mock_get_conn.return_value = mock_conn
    mock_cursor.columns.return_value = [(None, 'dbo', 't', 'c', None, 'INT', 10, None, None, None, None, None, None, None, None, None, 1, 'NO')]

    await get_table_schema(
        ctx=mock_tool_context,
        profile_name=sample_profile_name,
        table_name="some_table"
    )

    mock_get_conn.assert_called_once_with(sample_profile_name)
    mock_cursor.columns.assert_called_once_with(table='some_table', schema=None) # Add schema=None


@pytest.mark.asyncio
@patch('server.get_db_connection')
async def test_list_tables_uses_profile(
    mock_get_conn: MagicMock,
    mock_tool_context: AsyncMock,
    mock_db_connection: tuple,
    sample_profile_name: str,
):
    """Tests that list_tables calls get_db_connection with profile name."""
    mock_conn, mock_cursor = mock_db_connection
    mock_get_conn.return_value = mock_conn
    mock_cursor.tables.return_value = [MagicMock(table_name='table1')]

    await list_tables(
        ctx=mock_tool_context,
        profile_name=sample_profile_name,
        schema="dbo"
    )

    mock_get_conn.assert_called_once_with(sample_profile_name)
    mock_cursor.tables.assert_called_once_with(schema='dbo', tableType='TABLE')

# Add specific error case tests (e.g., invalid profile name, password not found in keyring)

@pytest.mark.asyncio
@patch('server.load_profiles', return_value={}) # Mock profiles to be empty
async def test_db_tool_invalid_profile_name(
    mock_load_profiles: MagicMock,
    mock_tool_context: AsyncMock,
    sample_profile_name: str
):
    """Tests ValueError when profile name is not found."""
    with pytest.raises(ValueError, match=f"Connection profile '{sample_profile_name}' not found."):
        await read_table_rows( # Use any db tool
            ctx=mock_tool_context,
            profile_name=sample_profile_name,
            table_name="any_table"
        )
    mock_load_profiles.assert_called_once()

@pytest.mark.asyncio
@patch('keyring.get_password', return_value=None)
@patch('server.load_profiles') # Patch load_profiles directly
async def test_db_tool_password_not_in_keyring(
    mock_load_profiles: MagicMock, # Add mock for load_profiles
    mock_get_pw: MagicMock,
    mock_tool_context: AsyncMock,
    sample_profile_name: str,
    sample_profile_data: dict # Need sample data to return from load_profiles
):
    """Tests ValueError when password is not found in keyring."""
    # Configure mock_load_profiles to return the sample profile
    mock_load_profiles.return_value = {sample_profile_name: sample_profile_data}

    with pytest.raises(ValueError, match="Password for profile.*not found in keyring"):
        await read_table_rows( # Use any db tool
            ctx=mock_tool_context,
            profile_name=sample_profile_name,
            table_name="any_table"
        )
    mock_get_pw.assert_called_once() # Check keyring was called


@pytest.mark.asyncio
@patch('server.get_db_connection')
async def test_read_table_rows_db_error(
    mock_get_conn: MagicMock,
    mock_tool_context: AsyncMock,
    mock_db_connection: tuple,
    sample_profile_name: str,
):
    """Tests that read_table_rows handles pyodbc.Error during execute."""
    mock_conn, mock_cursor = mock_db_connection
    mock_get_conn.return_value = mock_conn

    # Configure cursor.execute to raise a pyodbc.Error
    db_error = pyodbc.Error("HY000", "Database connection error")
    mock_cursor.execute.side_effect = db_error

    with pytest.raises(pyodbc.Error, match="Database connection error"):
        await read_table_rows(
            ctx=mock_tool_context,
            profile_name=sample_profile_name,
            table_name="error_table"
        )

    # Assertions
    mock_get_conn.assert_called_once_with(sample_profile_name)
    mock_cursor.execute.assert_called_once() # Verify execute was called
    mock_cursor.fetchall.assert_not_called() # Should not be called if execute fails
    mock_cursor.close.assert_called_once() # Verify cursor closed in finally
    mock_conn.close.assert_called_once()   # Verify connection closed in finally


@pytest.mark.asyncio
@patch('server.get_db_connection')
async def test_create_table_records_db_error(
    mock_get_conn: MagicMock,
    mock_tool_context: AsyncMock,
    mock_db_connection: tuple,
    sample_profile_name: str,
):
    """Tests that create_table_records handles pyodbc.Error during executemany and rolls back."""
    mock_conn, mock_cursor = mock_db_connection
    mock_get_conn.return_value = mock_conn
    records = [{"colA": 1, "colB": "test"}]

    # Configure cursor.executemany to raise a pyodbc.Error
    db_error = pyodbc.Error("23000", "Integrity constraint violation")
    mock_cursor.executemany.side_effect = db_error

    with pytest.raises(pyodbc.Error, match="Integrity constraint violation"):
        await create_table_records(
            ctx=mock_tool_context,
            profile_name=sample_profile_name,
            table_name="error_insert_table",
            records=records
        )

    # Assertions
    mock_get_conn.assert_called_once_with(sample_profile_name)
    mock_cursor.executemany.assert_called_once() # Verify executemany was called
    mock_conn.commit.assert_not_called()       # Verify commit was NOT called
    mock_conn.rollback.assert_called_once()    # Verify rollback WAS called
    mock_cursor.close.assert_called_once()     # Verify cursor closed in finally
    mock_conn.close.assert_called_once()       # Verify connection closed in finally


@pytest.mark.asyncio
@patch('server.get_db_connection')
async def test_update_table_records_db_error(
    mock_get_conn: MagicMock,
    mock_tool_context: AsyncMock,
    mock_db_connection: tuple,
    sample_profile_name: str,
):
    """Tests that update_table_records handles pyodbc.Error during execute and rolls back."""
    mock_conn, mock_cursor = mock_db_connection
    mock_get_conn.return_value = mock_conn
    updates = {"colA": 2}
    filters = {"id": 5}

    # Configure cursor.execute to raise a pyodbc.Error
    db_error = pyodbc.Error("42S02", "Invalid object name 'nonexistent_table'")
    mock_cursor.execute.side_effect = db_error

    with pytest.raises(pyodbc.Error, match="Invalid object name"):
        await update_table_records(
            ctx=mock_tool_context,
            profile_name=sample_profile_name,
            table_name="error_update_table",
            updates=updates,
            filters=filters
        )

    # Assertions
    mock_get_conn.assert_called_once_with(sample_profile_name)
    mock_cursor.execute.assert_called_once()   # Verify execute was called
    mock_conn.commit.assert_not_called()       # Verify commit was NOT called
    mock_conn.rollback.assert_called_once()    # Verify rollback WAS called
    mock_cursor.close.assert_called_once()     # Verify cursor closed in finally
    mock_conn.close.assert_called_once()       # Verify connection closed in finally


@pytest.mark.asyncio
@patch('server.get_db_connection')
async def test_delete_table_records_db_error(
    mock_get_conn: MagicMock,
    mock_tool_context: AsyncMock,
    mock_db_connection: tuple,
    sample_profile_name: str,
):
    """Tests that delete_table_records handles pyodbc.Error during execute and rolls back."""
    mock_conn, mock_cursor = mock_db_connection
    mock_get_conn.return_value = mock_conn
    filters = {"id": 99}

    # Configure cursor.execute to raise a pyodbc.Error
    db_error = pyodbc.Error("42S22", "Invalid column name 'nonexistent_col'") # Example error
    mock_cursor.execute.side_effect = db_error

    with pytest.raises(pyodbc.Error, match="Invalid column name"):
        await delete_table_records(
            ctx=mock_tool_context,
            profile_name=sample_profile_name,
            table_name="error_delete_table",
            filters=filters
        )

    # Assertions
    mock_get_conn.assert_called_once_with(sample_profile_name)
    mock_cursor.execute.assert_called_once()   # Verify execute was called
    mock_conn.commit.assert_not_called()       # Verify commit was NOT called
    mock_conn.rollback.assert_called_once()    # Verify rollback WAS called
    mock_cursor.close.assert_called_once()     # Verify cursor closed in finally
    mock_conn.close.assert_called_once()       # Verify connection closed in finally


@pytest.mark.asyncio
@patch('server.get_db_connection')
async def test_get_table_schema_db_error(
    mock_get_conn: MagicMock,
    mock_tool_context: AsyncMock,
    mock_db_connection: tuple,
    sample_profile_name: str,
):
    """Tests that get_table_schema handles pyodbc.Error during columns call."""
    mock_conn, mock_cursor = mock_db_connection
    mock_get_conn.return_value = mock_conn

    # Configure cursor.columns to raise a pyodbc.Error
    db_error = pyodbc.Error("HY008", "Operation canceled") # Example error
    mock_cursor.columns.side_effect = db_error

    with pytest.raises(pyodbc.Error, match="Operation canceled"):
        await get_table_schema(
            ctx=mock_tool_context,
            profile_name=sample_profile_name,
            table_name="error_schema_table"
        )

    # Assertions
    mock_get_conn.assert_called_once_with(sample_profile_name)
    mock_cursor.columns.assert_called_once_with(table='error_schema_table', schema=None) # Add schema=None
    mock_cursor.close.assert_called_once()     # Verify cursor closed in finally
    mock_conn.close.assert_called_once()       # Verify connection closed in finally


@pytest.mark.asyncio
@patch('server.get_db_connection')
async def test_list_tables_db_error(
    mock_get_conn: MagicMock,
    mock_tool_context: AsyncMock,
    mock_db_connection: tuple,
    sample_profile_name: str,
):
    """Tests that list_tables handles pyodbc.Error during tables call."""
    mock_conn, mock_cursor = mock_db_connection
    mock_get_conn.return_value = mock_conn

    # Configure cursor.tables to raise a pyodbc.Error
    db_error = pyodbc.Error("IM001", "Driver does not support this function") # Example error
    mock_cursor.tables.side_effect = db_error

    with pytest.raises(pyodbc.Error, match="Driver does not support"):
        await list_tables(
            ctx=mock_tool_context,
            profile_name=sample_profile_name,
            schema="error_schema"
        )

    # Assertions
    mock_get_conn.assert_called_once_with(sample_profile_name)
    mock_cursor.tables.assert_called_once_with(schema='error_schema', tableType='TABLE') # Verify tables was called
    mock_cursor.close.assert_called_once()     # Verify cursor closed in finally
    mock_conn.close.assert_called_once()       # Verify connection closed in finally


# --- Tests for Advanced Filtering in read_table_rows ---

@pytest.mark.asyncio
@patch('server.get_db_connection')
async def test_read_table_rows_advanced_filters(
    mock_get_conn: MagicMock,
    mock_tool_context: AsyncMock,
    mock_db_connection: tuple,
    sample_profile_name: str,
):
    """Tests read_table_rows with various advanced filter operators."""
    mock_conn, mock_cursor = mock_db_connection
    mock_get_conn.return_value = mock_conn
    mock_cursor.fetchall.return_value = [(1, 'Test')] # Dummy data
    mock_cursor.description = [('id', int), ('name', str)]

    filters = {
        "Age": {"operator": ">", "value": 30},
        "Status": {"operator": "IN", "value": ["Active", "Pending"]},
        "Name": {"operator": "LIKE", "value": "J%"},
        "Score": {"operator": "<=", "value": 100}
    }
    order_by = {"Name": "ASC", "Age": "DESC"} # Add order_by for testing

    await read_table_rows(
        ctx=mock_tool_context,
        profile_name=sample_profile_name,
        table_name="advanced_users",
        filters=filters,
        columns=["id", "name"],
        order_by=order_by, # Pass order_by
        limit=10 # Add limit to ensure order_by is used
    )

    # Updated expected SQL to include OFFSET 0 ROWS which is added when limit is present
    expected_sql = "SELECT [id], [name] FROM [advanced_users] WHERE [Age] > ? AND [Status] IN (?, ?) AND [Name] LIKE ? AND [Score] <= ? ORDER BY [Name] ASC, [Age] DESC OFFSET 0 ROWS FETCH NEXT 10 ROWS ONLY"
    expected_params = [30, "Active", "Pending", "J%", 100]

    mock_get_conn.assert_called_once_with(sample_profile_name)
    # Check the generated SQL and parameters
    call_args, call_kwargs = mock_cursor.execute.call_args
    assert call_args[0] == expected_sql
    assert call_args[1] == expected_params
    mock_cursor.fetchall.assert_called_once()
    mock_cursor.close.assert_called_once()
    mock_conn.close.assert_called_once()


@pytest.mark.asyncio
@patch('server.get_db_connection')
async def test_read_table_rows_empty_in_filter(
    mock_get_conn: MagicMock,
    mock_tool_context: AsyncMock,
    mock_db_connection: tuple,
    sample_profile_name: str,
):
    """Tests read_table_rows with an empty list for the IN operator."""
    mock_conn, mock_cursor = mock_db_connection
    mock_get_conn.return_value = mock_conn
    mock_cursor.fetchall.return_value = [] # Expect no results
    mock_cursor.description = [('id', int)]

    filters = {
        "Status": {"operator": "IN", "value": []}
    }

    await read_table_rows(
        ctx=mock_tool_context,
        profile_name=sample_profile_name,
        table_name="empty_in_test",
        filters=filters
    )

    # Expect the query to contain '1 = 0' and no parameters for the IN clause
    # Corrected expected SQL: ORDER BY should not be present if limit/offset are None
    expected_sql = "SELECT * FROM [empty_in_test] WHERE 1 = 0"
    expected_params = []

    mock_get_conn.assert_called_once_with(sample_profile_name)
    call_args, call_kwargs = mock_cursor.execute.call_args
    assert call_args[0] == expected_sql
    assert call_args[1] == expected_params
    mock_cursor.fetchall.assert_called_once()


@pytest.mark.asyncio
async def test_read_table_rows_invalid_filter_format(
    mock_tool_context: AsyncMock,
    sample_profile_name: str,
):
    """Tests ValueError when filter format is incorrect."""
    filters = {
        "Age": "> 30" # Incorrect format, should be dict
    }
    with pytest.raises(ValueError, match="Invalid filter format for column 'Age'"):
        await read_table_rows(
            ctx=mock_tool_context,
            profile_name=sample_profile_name,
            table_name="users",
            filters=filters
        )

    filters_missing_keys = {
        "Name": {"op": "LIKE", "val": "J%"} # Missing 'operator' and 'value' keys
    }
    with pytest.raises(ValueError, match="Invalid filter format for column 'Name'"):
        await read_table_rows(
            ctx=mock_tool_context,
            profile_name=sample_profile_name,
            table_name="users",
            filters=filters_missing_keys
        )


@pytest.mark.asyncio
async def test_read_table_rows_unsupported_operator(
    mock_tool_context: AsyncMock,
    sample_profile_name: str,
):
    """Tests ValueError when an unsupported filter operator is used."""
    filters = {
        "Age": {"operator": "BETWEEN", "value": [20, 40]} # Unsupported operator
    }
    with pytest.raises(ValueError, match="Unsupported filter operator 'BETWEEN'"):
        await read_table_rows(
            ctx=mock_tool_context,
            profile_name=sample_profile_name,
            table_name="users",
            filters=filters
        )


@pytest.mark.asyncio
async def test_read_table_rows_invalid_filter_column(
    mock_tool_context: AsyncMock,
    sample_profile_name: str,
):
    """Tests ValueError when filter column name is not a valid identifier."""
    filters = {
        "Invalid Column Name": {"operator": "=", "value": 1}
    }
    with pytest.raises(ValueError, match="Invalid filter column name provided: 'Invalid Column Name'"):
        await read_table_rows(
            ctx=mock_tool_context,
            profile_name=sample_profile_name,
            table_name="users",
            filters=filters
        )


# --- Tests for Order By in read_table_rows ---

@pytest.mark.asyncio
@patch('server.get_db_connection')
async def test_read_table_rows_with_order_by(
    mock_get_conn: MagicMock,
    mock_tool_context: AsyncMock,
    mock_db_connection: tuple,
    sample_profile_name: str,
):
    """Tests read_table_rows with the order_by parameter."""
    mock_conn, mock_cursor = mock_db_connection
    mock_get_conn.return_value = mock_conn
    mock_cursor.fetchall.return_value = [(1, 'Zebra'), (2, 'Apple')] # Dummy data
    mock_cursor.description = [('id', int), ('name', str)]

    order_by = {"name": "DESC", "id": "ASC"}

    await read_table_rows(
        ctx=mock_tool_context,
        profile_name=sample_profile_name,
        table_name="ordered_items",
        columns=["id", "name"],
        order_by=order_by
    )

    expected_sql = "SELECT [id], [name] FROM [ordered_items] ORDER BY [name] DESC, [id] ASC"
    expected_params = []

    mock_get_conn.assert_called_once_with(sample_profile_name)
    call_args, call_kwargs = mock_cursor.execute.call_args
    assert call_args[0] == expected_sql
    assert call_args[1] == expected_params
    mock_cursor.fetchall.assert_called_once()
    mock_cursor.close.assert_called_once()
    mock_conn.close.assert_called_once()


@pytest.mark.asyncio
async def test_read_table_rows_order_by_invalid_column(
    mock_tool_context: AsyncMock,
    sample_profile_name: str,
):
    """Tests ValueError when order_by column name is not a valid identifier."""
    order_by = {"Invalid Name": "ASC"}
    with pytest.raises(ValueError, match="Invalid order_by column name provided: 'Invalid Name'"):
        await read_table_rows(
            ctx=mock_tool_context,
            profile_name=sample_profile_name,
            table_name="users",
            order_by=order_by
        )


@pytest.mark.asyncio
async def test_read_table_rows_order_by_invalid_direction(
    mock_tool_context: AsyncMock,
    sample_profile_name: str,
):
    """Tests ValueError when order_by direction is invalid."""
    order_by = {"name": "UP"} # Invalid direction
    with pytest.raises(ValueError, match="Invalid order_by direction 'UP'. Must be 'ASC' or 'DESC'."):
        await read_table_rows(
            ctx=mock_tool_context,
            profile_name=sample_profile_name,
            table_name="users",
            order_by=order_by
        )


@pytest.mark.asyncio
@patch('server.get_db_connection')
async def test_read_table_rows_limit_offset_without_order_by_warning(
    mock_get_conn: MagicMock,
    mock_tool_context: AsyncMock,
    mock_db_connection: tuple,
    sample_profile_name: str,
):
    """Tests that a warning is logged and sent when limit/offset is used without order_by."""
    mock_conn, mock_cursor = mock_db_connection
    mock_get_conn.return_value = mock_conn
    mock_cursor.fetchall.return_value = []
    mock_cursor.description = []

    await read_table_rows(
        ctx=mock_tool_context,
        profile_name=sample_profile_name,
        table_name="warning_test",
        limit=10
        # No order_by provided
    )

    # Check that the default ORDER BY (SELECT NULL) is used
    # Updated expected SQL to include OFFSET 0 ROWS which is added when limit is present
    expected_sql = "SELECT * FROM [warning_test] ORDER BY (SELECT NULL) OFFSET 0 ROWS FETCH NEXT 10 ROWS ONLY"
    call_args, call_kwargs = mock_cursor.execute.call_args
    assert call_args[0] == expected_sql

    # Check that the warning message was sent via ctx
    mock_tool_context.send_message.assert_any_call("Warning: Using limit/offset without specifying order_by. Pagination results may be unpredictable.")


@pytest.mark.asyncio
async def test_read_table_rows_in_filter_non_list(
    mock_tool_context: AsyncMock,
    sample_profile_name: str,
):
    """Tests ValueError when the value for an IN filter is not a list."""
    filters = {
        "Status": {"operator": "IN", "value": "Active"} # Value should be a list
    }
    with pytest.raises(ValueError, match="Value for 'IN' operator must be a list for column 'Status'"):
        await read_table_rows(
            ctx=mock_tool_context,
            profile_name=sample_profile_name,
            table_name="users",
            filters=filters
        )