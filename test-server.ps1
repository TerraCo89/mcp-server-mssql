# PowerShell script to test MSSQL MCP server with different profile directories
param (
    [string]$ProfilesDir,
    [switch]$CreateCustomDir
)

Write-Host "Starting MSSQL MCP Server Test" -ForegroundColor Cyan

# Function to create and test with a custom profiles directory
function Test-WithCustomDir {
    param (
        [string]$CustomDir
    )
    
    # Create the test directory if it doesn't exist
    if (-not (Test-Path $CustomDir)) {
        Write-Host "Creating custom profiles directory: $CustomDir" -ForegroundColor Yellow
        New-Item -Path $CustomDir -ItemType Directory -Force | Out-Null
    }
    
    Write-Host "Testing server with custom profiles directory: $CustomDir" -ForegroundColor Green
    
    # Set environment variable and run the server
    Write-Host "Setting MCP_PROFILES_DIR=$CustomDir and starting server..."
    $env:MCP_PROFILES_DIR = $CustomDir
    try {
        python server.py
    }
    catch {
        Write-Host "Error running server: $_" -ForegroundColor Red
    }
    finally {
        # Clean up environment variable
        Remove-Item Env:\MCP_PROFILES_DIR
    }
}

# Function to test with default directory
function Test-WithDefaultDir {
    Write-Host "Testing server with default profiles directory" -ForegroundColor Green
    
    # Run the server with default directory
    try {
        python server.py
    }
    catch {
        Write-Host "Error running server: $_" -ForegroundColor Red
    }
}

# Main execution logic
if ($CreateCustomDir -and -not $ProfilesDir) {
    # Create a test directory in the current location
    $testDir = Join-Path -Path (Get-Location) -ChildPath "test_profiles"
    Test-WithCustomDir -CustomDir $testDir
}
elseif ($ProfilesDir) {
    # Use the provided profiles directory
    Test-WithCustomDir -CustomDir $ProfilesDir
}
else {
    # Use default directory
    Test-WithDefaultDir
}

Write-Host "Test complete" -ForegroundColor Cyan 