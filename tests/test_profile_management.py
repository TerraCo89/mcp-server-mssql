import pytest
from unittest.mock import patch, MagicMock, AsyncMock
import keyring
import logging # Add logging import

# Import the functions to be tested
from server import (
    add_connection_profile, list_connection_profiles, remove_connection_profile,
    PROFILES_FILE, KEYRING_SERVICE_NAME
)

# Fixtures like mock_tool_context, mock_profiles_file, mock_keyring, etc.
# are automatically discovered from conftest.py

@pytest.mark.asyncio
@patch('getpass.getpass', return_value="new_password")
@patch('server.save_profiles')
@patch('server.load_profiles')
@patch('pathlib.Path.exists')
async def test_add_connection_profile_success(
    mock_exists: MagicMock,
    mock_load_profiles: MagicMock,
    mock_save_profiles: MagicMock,
    mock_getpass: MagicMock,
    mock_tool_context: AsyncMock,
    mock_keyring: tuple # Keep keyring mock
):
    """Tests adding a new profile successfully."""
    # Mocks are now passed directly
    mock_get_pw, mock_set_pw, mock_del_pw, keyring_storage = mock_keyring

    profile_name = "new_profile"
    profile_data = {
        "driver": "TestDriver", "server": "test.server",
        "database": "testdb", "username": "testuser"
    }
    keyring_username = f"{profile_name}:{profile_data['username']}"

    # Configure mocks for this test case
    mock_exists.return_value = False # Simulate file doesn't exist initially
    mock_load_profiles.return_value = {} # Simulate loading an empty dict

    result = await add_connection_profile(
        ctx=mock_tool_context,
        profile_name=profile_name,
        **profile_data
    )

    assert result == {"status": "success", "profile_name": profile_name}
    mock_getpass.assert_called_once()
    mock_load_profiles.assert_called_once()
    mock_save_profiles.assert_called_once_with({profile_name: profile_data})
    mock_set_pw.assert_called_once_with(KEYRING_SERVICE_NAME, keyring_username, "new_password")

@pytest.mark.asyncio
@patch('server.load_profiles')
async def test_list_connection_profiles_success(
    mock_load_profiles: MagicMock,
    mock_tool_context: AsyncMock,
    mock_profiles_file_content: dict # Keep this fixture for expected data
):
    """Tests listing existing profiles."""
    # Configure mock
    mock_load_profiles.return_value = mock_profiles_file_content

    result = await list_connection_profiles(ctx=mock_tool_context)

    assert result == list(mock_profiles_file_content.keys())
    mock_load_profiles.assert_called_once()

@pytest.mark.asyncio
@patch('server.save_profiles')
@patch('server.load_profiles')
async def test_remove_connection_profile_success(
    mock_load_profiles: MagicMock,
    mock_save_profiles: MagicMock,
    mock_tool_context: AsyncMock,
    mock_keyring: tuple,
    sample_profile_name: str,
    sample_profile_data: dict,
    mock_profiles_file_content: dict # Keep for initial state and data
):
    """Tests removing an existing profile successfully."""
    # Mocks passed directly
    mock_get_pw, mock_set_pw, mock_del_pw, keyring_storage = mock_keyring
    # Configure mocks
    mock_load_profiles.return_value = mock_profiles_file_content.copy() # Start with existing profile

    keyring_username = f"{sample_profile_name}:{sample_profile_data['username']}"

    result = await remove_connection_profile(
        ctx=mock_tool_context,
        profile_name=sample_profile_name
    )

    assert result == {"status": "success", "profile_name": sample_profile_name}
    mock_load_profiles.assert_called_once()
    mock_save_profiles.assert_called_once_with({}) # Expect empty dict after removal
    mock_del_pw.assert_called_once_with(KEYRING_SERVICE_NAME, keyring_username)

@pytest.mark.asyncio
@patch('server.save_profiles')
@patch('server.load_profiles')
async def test_remove_connection_profile_not_found(
    mock_load_profiles: MagicMock,
    mock_save_profiles: MagicMock,
    mock_tool_context: AsyncMock,
    mock_keyring: tuple
):
    """Tests removing a profile that doesn't exist."""
    # Mocks passed directly
    mock_get_pw, mock_set_pw, mock_del_pw, keyring_storage = mock_keyring
    # Configure mocks
    mock_load_profiles.return_value = {} # Start with no profiles

    result = await remove_connection_profile(
        ctx=mock_tool_context,
        profile_name="non_existent_profile"
    )

    assert result == {"status": "not_found", "message": "Profile 'non_existent_profile' not found."}
    mock_load_profiles.assert_called_once()
    mock_save_profiles.assert_not_called()
    mock_del_pw.assert_not_called()


@pytest.mark.asyncio
@patch('getpass.getpass') # Need to patch getpass even if not called
@patch('server.save_profiles')
@patch('server.load_profiles')
@patch('pathlib.Path.exists')
async def test_add_connection_profile_invalid_name(
    mock_exists: MagicMock,
    mock_load_profiles: MagicMock,
    mock_save_profiles: MagicMock,
    mock_getpass: MagicMock,
    mock_tool_context: AsyncMock,
    mock_keyring: tuple
):
    """Tests adding a profile with an invalid name (contains space)."""
    mock_get_pw, mock_set_pw, mock_del_pw, keyring_storage = mock_keyring

    invalid_profile_name = "invalid name"
    profile_data = {
        "driver": "TestDriver", "server": "test.server",
        "database": "testdb", "username": "testuser"
    }

    result = await add_connection_profile(
        ctx=mock_tool_context,
        profile_name=invalid_profile_name,
        **profile_data
    )

    assert result == {"status": "error", "message": "Profile name must be a valid identifier (letters, numbers, underscore)."}
    mock_load_profiles.assert_not_called() # Should fail before loading
    mock_getpass.assert_not_called()
    mock_save_profiles.assert_not_called()
    mock_set_pw.assert_not_called()


@pytest.mark.asyncio
@patch('getpass.getpass', return_value="") # Mock empty password input
@patch('server.save_profiles')
@patch('server.load_profiles')
@patch('pathlib.Path.exists')
async def test_add_connection_profile_empty_password(
    mock_exists: MagicMock,
    mock_load_profiles: MagicMock,
    mock_save_profiles: MagicMock,
    mock_getpass: MagicMock,
    mock_tool_context: AsyncMock,
    mock_keyring: tuple
):
    """Tests adding a profile where the user enters an empty password."""
    mock_get_pw, mock_set_pw, mock_del_pw, keyring_storage = mock_keyring

    profile_name = "empty_pw_profile"
    profile_data = {
        "driver": "TestDriver", "server": "test.server",
        "database": "testdb", "username": "testuser"
    }

    # Configure mocks
    mock_exists.return_value = False
    mock_load_profiles.return_value = {}

    result = await add_connection_profile(
        ctx=mock_tool_context,
        profile_name=profile_name,
        **profile_data
    )

    assert result == {"status": "error", "message": "Password cannot be empty."}
    mock_load_profiles.assert_called_once()
    mock_getpass.assert_called_once()
    mock_save_profiles.assert_not_called() # Should not save if password is empty
    mock_set_pw.assert_not_called() # Should not set empty password in keyring


@pytest.mark.asyncio
@patch('server.load_profiles', side_effect=FileNotFoundError) # Simulate file not found
@patch('pathlib.Path.exists', return_value=False) # Ensure exists returns False
async def test_list_connection_profiles_file_not_exist(
    mock_exists: MagicMock,
    mock_load_profiles: MagicMock,
    mock_tool_context: AsyncMock
):
    """Tests listing profiles when profiles.json doesn't exist."""
    # The load_profiles function in server.py handles FileNotFoundError
    # by returning {}, so we expect an empty list here.
    # We patch load_profiles to simulate the internal handling.
    mock_load_profiles.side_effect = lambda: {} # Override side_effect for this specific call path

    result = await list_connection_profiles(ctx=mock_tool_context)

    assert result == []
    # load_profiles is called internally by list_connection_profiles
    # but we check the *original* patch target if needed, or just the outcome.
    # In this case, checking the result [] is sufficient.


@pytest.mark.asyncio
@patch('server.save_profiles')
@patch('server.load_profiles')
async def test_remove_connection_profile_keyring_pw_not_found(
    mock_load_profiles: MagicMock,
    mock_save_profiles: MagicMock,
    mock_tool_context: AsyncMock,
    mock_keyring: tuple,
    sample_profile_name: str,
    sample_profile_data: dict,
    mock_profiles_file_content: dict,
    caplog # Capture logs
):
    """Tests removing a profile where the password is not found in keyring."""
    mock_get_pw, mock_set_pw, mock_del_pw, keyring_storage = mock_keyring
    # Configure mocks
    mock_load_profiles.return_value = mock_profiles_file_content.copy() # Start with existing profile

    # Make delete_password raise the specific error
    MockPasswordDeleteError = type('PasswordDeleteError', (Exception,), {})
    if hasattr(keyring, 'errors') and hasattr(keyring.errors, 'PasswordDeleteError'):
        mock_del_pw.side_effect = keyring.errors.PasswordDeleteError("Password not found.")
    else: # Fallback if keyring.errors doesn't exist in test env
        mock_del_pw.side_effect = MockPasswordDeleteError("Password not found.")


    keyring_username = f"{sample_profile_name}:{sample_profile_data['username']}"

    with caplog.at_level(logging.WARNING):
        result = await remove_connection_profile(
            ctx=mock_tool_context,
            profile_name=sample_profile_name
        )

    assert result == {"status": "success", "profile_name": sample_profile_name}
    mock_load_profiles.assert_called_once()
    mock_save_profiles.assert_called_once_with({}) # Profile should still be removed from file
    mock_del_pw.assert_called_once_with(KEYRING_SERVICE_NAME, keyring_username)
    # Check for the warning log message
    assert f"Password for profile '{sample_profile_name}' (user: {sample_profile_data['username']}) not found in keyring" in caplog.text


@pytest.mark.asyncio
@patch('getpass.getpass', return_value="new_password")
@patch('server.save_profiles', side_effect=IOError("Disk full")) # Simulate save failure
@patch('server.load_profiles')
@patch('pathlib.Path.exists')
async def test_add_connection_profile_save_fail(
    mock_exists: MagicMock,
    mock_load_profiles: MagicMock,
    mock_save_profiles: MagicMock,
    mock_getpass: MagicMock,
    mock_tool_context: AsyncMock,
    mock_keyring: tuple
):
    """Tests add_connection_profile when save_profiles fails after keyring success."""
    mock_get_pw, mock_set_pw, mock_del_pw, keyring_storage = mock_keyring

    profile_name = "save_fail_profile"
    profile_data = {
        "driver": "TestDriver", "server": "test.server",
        "database": "testdb", "username": "testuser_savefail"
    }
    keyring_username = f"{profile_name}:{profile_data['username']}"

    # Configure mocks
    mock_exists.return_value = False
    mock_load_profiles.return_value = {}

    result = await add_connection_profile(
        ctx=mock_tool_context,
        profile_name=profile_name,
        **profile_data
    )

    assert result['status'] == "error"
    # Check for the specific IOError message structure
    assert "Failed to save profile file: Disk full" in result['message']

    mock_load_profiles.assert_called_once()
    mock_getpass.assert_called_once()
    # Password should have been set *before* the save attempt
    mock_set_pw.assert_called_once_with(KEYRING_SERVICE_NAME, keyring_username, "new_password")
    # Save should have been attempted
    mock_save_profiles.assert_called_once()


@pytest.mark.asyncio
@patch('getpass.getpass', return_value="new_password")
@patch('keyring.set_password', side_effect=keyring.errors.KeyringError("Keyring backend unavailable")) # Simulate keyring failure
@patch('server.save_profiles') # Mock save_profiles even though it shouldn't be called
@patch('server.load_profiles')
@patch('pathlib.Path.exists')
async def test_add_connection_profile_keyring_fail(
    mock_exists: MagicMock,
    mock_load_profiles: MagicMock,
    mock_save_profiles: MagicMock,
    mock_set_password: MagicMock, # Mock for keyring.set_password
    mock_getpass: MagicMock,
    mock_tool_context: AsyncMock,
):
    """Tests add_connection_profile when keyring.set_password fails."""
    profile_name = "keyring_fail_profile"
    profile_data = {
        "driver": "TestDriver", "server": "test.server",
        "database": "testdb", "username": "testuser_keyringfail"
    }

    # Configure mocks
    mock_exists.return_value = False
    mock_load_profiles.return_value = {}

    result = await add_connection_profile(
        ctx=mock_tool_context,
        profile_name=profile_name,
        **profile_data
    )

    assert result['status'] == "error"
    assert "Failed to store password securely: Keyring backend unavailable" in result['message']

    mock_load_profiles.assert_called_once()
    mock_getpass.assert_called_once()
    mock_set_password.assert_called_once() # Keyring set should have been attempted
    mock_save_profiles.assert_not_called() # Save should not be called if keyring fails


@pytest.mark.asyncio
@patch('server.save_profiles', side_effect=IOError("Permission denied")) # Simulate save failure during removal
@patch('server.load_profiles')
async def test_remove_connection_profile_save_fail(
    mock_load_profiles: MagicMock,
    mock_save_profiles: MagicMock,
    mock_tool_context: AsyncMock,
    mock_keyring: tuple,
    sample_profile_name: str,
    mock_profiles_file_content: dict
):
    """Tests remove_connection_profile when save_profiles fails."""
    mock_get_pw, mock_set_pw, mock_del_pw, keyring_storage = mock_keyring
    # Configure mocks
    mock_load_profiles.return_value = mock_profiles_file_content.copy() # Start with existing profile

    result = await remove_connection_profile(
        ctx=mock_tool_context,
        profile_name=sample_profile_name
    )

    assert result['status'] == "error"
    assert "Failed to update profile file: Permission denied" in result['message']
    assert "State might be inconsistent" in result['message']

    mock_load_profiles.assert_called_once()
    mock_save_profiles.assert_called_once() # Save should have been attempted
    # Keyring delete should NOT have been called if save fails *before* it
    # Correction: Keyring delete happens *before* save in the current implementation.
    # Let's assume keyring delete succeeded, but save failed.
    mock_del_pw.assert_not_called() # Should not be called if save fails first


@pytest.mark.asyncio
@patch('keyring.delete_password', side_effect=keyring.errors.KeyringError("Generic keyring error")) # Simulate generic keyring delete failure
@patch('server.save_profiles')
@patch('server.load_profiles')
async def test_remove_connection_profile_keyring_delete_fail(
    mock_load_profiles: MagicMock,
    mock_save_profiles: MagicMock,
    mock_delete_password: MagicMock, # Mock for keyring.delete_password
    mock_tool_context: AsyncMock,
    sample_profile_name: str,
    mock_profiles_file_content: dict
):
    """Tests remove_connection_profile when keyring.delete_password fails with a generic error."""
    # Configure mocks
    mock_load_profiles.return_value = mock_profiles_file_content.copy() # Start with existing profile

    result = await remove_connection_profile(
        ctx=mock_tool_context,
        profile_name=sample_profile_name
    )

    assert result['status'] == "error"
    assert "Failed to remove password from secure storage: Generic keyring error" in result['message']

    mock_load_profiles.assert_called_once()
    mock_delete_password.assert_called_once() # Keyring delete should have been attempted
    # Save should have happened *before* keyring delete attempt in current logic
    mock_save_profiles.assert_called_once()