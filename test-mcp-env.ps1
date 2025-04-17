# Test script to simulate how Cursor runs the MCP server
Write-Host "Testing MCP server with explicit environment variables..." -ForegroundColor Green

# Set environment variables (same as in your .env file)
$env:MSSQL_HOST = "localhost"
$env:MSSQL_PORT = "1433"
$env:MSSQL_USER = "sa"
$env:MSSQL_PASSWORD = "SqlServer2019!"
$env:MSSQL_DATABASE = "master"
$env:MSSQL_ENCRYPT = "false"
$env:MSSQL_TRUST_SERVER_CERTIFICATE = "true" 
$env:LOG_LEVEL = "debug"

# Run the server with the same command Cursor uses
$command = "node D:/source/cernjarvis/mcp-server-mssql/dist/server.js --stdio"
Write-Host "Running: $command" -ForegroundColor Cyan

# Send a test MCP request to the server
$testRequest = @"
{"jsonrpc":"2.0","method":"ListTools","id":1,"params":{}}
"@

# Run the command and pipe the test request to it
$testRequest | cmd /c $command

Write-Host "Done!" -ForegroundColor Green 