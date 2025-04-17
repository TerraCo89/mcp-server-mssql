#!/bin/bash
# Bash script to test MSSQL MCP server with different profile directories

# Set color codes for output
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
CYAN='\033[0;36m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${CYAN}Starting MSSQL MCP Server Test${NC}"

# Function to test with a custom profiles directory
test_with_custom_dir() {
    local custom_dir="$1"
    
    # Create the test directory if it doesn't exist
    if [ ! -d "$custom_dir" ]; then
        echo -e "${YELLOW}Creating custom profiles directory: $custom_dir${NC}"
        mkdir -p "$custom_dir"
    fi
    
    echo -e "${GREEN}Testing server with custom profiles directory: $custom_dir${NC}"
    
    # Set environment variable and run the server
    echo "Setting MCP_PROFILES_DIR=$custom_dir and starting server..."
    MCP_PROFILES_DIR="$custom_dir" python server.py
}

# Function to test with default directory
test_with_default_dir() {
    echo -e "${GREEN}Testing server with default profiles directory${NC}"
    
    # Run the server with default directory
    python server.py
}

# Parse command line arguments
create_custom_dir=0
profiles_dir=""

while [[ "$#" -gt 0 ]]; do
    case $1 in
        -c|--create-custom-dir) create_custom_dir=1; shift ;;
        -d|--profiles-dir) profiles_dir="$2"; shift 2 ;;
        *) echo -e "${RED}Unknown parameter: $1${NC}"; exit 1 ;;
    esac
done

# Main execution logic
if [ $create_custom_dir -eq 1 ] && [ -z "$profiles_dir" ]; then
    # Create a test directory in the current location
    test_dir="$(pwd)/test_profiles"
    test_with_custom_dir "$test_dir"
elif [ -n "$profiles_dir" ]; then
    # Use the provided profiles directory
    test_with_custom_dir "$profiles_dir"
else
    # Use default directory
    test_with_default_dir
fi

echo -e "${CYAN}Test complete${NC}" 