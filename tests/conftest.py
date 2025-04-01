import pytest
import pyodbc
import json
import keyring
import getpass
from pathlib import Path
from unittest.mock import patch, MagicMock, AsyncMock, mock_open
from typing import Dict, Any
import asyncio
import sys
import os

# Add parent directory to path to import server module
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

# Import constants needed for fixtures
from server import PROFILES_FILE, KEYRING_SERVICE_NAME
# ToolContext is implicitly handled by @mcp.tool(), no explicit import needed.

# --- Test Fixtures ---

@pytest.fixture
def mock_tool_context():
    """Provides a mock context object (simulating ToolContext)."""
    # Mock without spec as ToolContext import failed / is implicit
    mock_ctx = AsyncMock()
    mock_ctx.send_message = AsyncMock()
    return mock_ctx

@pytest.fixture
def mock_db_connection():
    """Provides a mock pyodbc connection and cursor."""
    mock_conn = MagicMock(spec=pyodbc.Connection)
    mock_cursor = MagicMock(spec=pyodbc.Cursor)
    mock_conn.cursor.return_value = mock_cursor
    return mock_conn, mock_cursor

@pytest.fixture
def sample_profile_name():
    """Provides a sample profile name."""
    return "test_profile"

@pytest.fixture
def sample_profile_data(sample_profile_name):
    """Provides sample profile data (non-sensitive part)."""
    return {
        "driver": "{ODBC Driver 17 for SQL Server}",
        "server": "mock_server",
        "database": "mock_db",
        "username": "mock_user"
    }

@pytest.fixture
def sample_password():
    """Provides a sample password."""
    return "mock_password"

@pytest.fixture
def mock_profiles_file_content(sample_profile_name, sample_profile_data):
    """Provides mock content for profiles.json."""
    return {sample_profile_name: sample_profile_data}

# --- Mocks for Keyring and File I/O ---

@pytest.fixture(autouse=True)
def mock_keyring(sample_profile_name, sample_profile_data, sample_password):
    """Mocks keyring functions."""
    keyring_storage = {}
    keyring_username = f"{sample_profile_name}:{sample_profile_data['username']}"
    keyring_storage[keyring_username] = sample_password

    def mock_get_password(service, username):
        assert service == KEYRING_SERVICE_NAME
        return keyring_storage.get(username)

    def mock_set_password(service, username, password):
        assert service == KEYRING_SERVICE_NAME
        keyring_storage[username] = password

    def mock_delete_password(service, username):
        assert service == KEYRING_SERVICE_NAME
        if username not in keyring_storage:
             MockPasswordDeleteError = type('PasswordDeleteError', (Exception,), {})
             if hasattr(keyring, 'errors') and hasattr(keyring.errors, 'PasswordDeleteError'):
                 raise keyring.errors.PasswordDeleteError("Password not found.")
             else:
                 raise MockPasswordDeleteError("Password not found.")
        del keyring_storage[username]

    try:
        import keyring.errors
    except ImportError:
        class MockPasswordDeleteError(Exception): pass
        if not hasattr(keyring, 'errors'): keyring.errors = MagicMock()
        keyring.errors.PasswordDeleteError = MockPasswordDeleteError

    with patch('keyring.get_password', side_effect=mock_get_password) as mock_get, \
         patch('keyring.set_password', side_effect=mock_set_password) as mock_set, \
         patch('keyring.delete_password', side_effect=mock_delete_password) as mock_del:
        yield mock_get, mock_set, mock_del, keyring_storage

@pytest.fixture
def mock_profiles_file(mock_profiles_file_content):
    """Mocks the profiles.json file read/write using an in-memory dict."""
    # This dictionary holds the state *within* the fixture's scope
    fixture_state = mock_profiles_file_content.copy()

    def _mock_load(file):
        # Always return the current state from the fixture's scope
        return fixture_state.copy()

    def _mock_dump(data, file, indent):
        nonlocal fixture_state
        # Update the state within the fixture's scope
        fixture_state.clear()
        fixture_state.update(data)
        # Ensure the exists mock reflects the new state
        mock_exists.side_effect = lambda *args: args and args[0] == PROFILES_FILE and bool(fixture_state)


    m_open = mock_open()
    # Initial side effect for exists
    initial_exists_side_effect = lambda *args: args and args[0] == PROFILES_FILE and bool(fixture_state)

    with patch('json.load', side_effect=_mock_load) as mock_jload, \
         patch('json.dump', side_effect=_mock_dump) as mock_jdump, \
         patch('pathlib.Path.exists', side_effect=initial_exists_side_effect) as mock_exists, \
         patch('builtins.open', m_open) as mock_file:
        # Yield only the mocks, not the state dictionary
        yield mock_file, mock_jload, mock_jdump, mock_exists

# Mock asyncio.to_thread globally for all tests in this session
@pytest.fixture(autouse=True)
def mock_asyncio_to_thread():
    """Mocks asyncio.to_thread to run functions synchronously for testing."""
    def sync_executor(func, *args, **kwargs):
        return func(*args, **kwargs)
    with patch('asyncio.to_thread', side_effect=sync_executor) as mock_async_to_thread:
        yield mock_async_to_thread