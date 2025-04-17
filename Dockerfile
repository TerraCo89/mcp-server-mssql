# Use Node.js with TypeScript as the base image
FROM node:18-slim

# Set environment variables to prevent interactive prompts during installation
ENV DEBIAN_FRONTEND=noninteractive

# Install ODBC driver dependencies and the driver itself
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        gnupg2 \
        curl \
        apt-transport-https \
        lsb-release \
        unixodbc \
        unixodbc-dev \
    # Add Microsoft GPG key securely
    && curl https://packages.microsoft.com/keys/microsoft.asc | gpg --dearmor > /etc/apt/trusted.gpg.d/microsoft.gpg \
    # Add Microsoft repository
    && curl https://packages.microsoft.com/config/debian/11/prod.list > /etc/apt/sources.list.d/mssql-release.list \
    # Update package list again after adding repo
    && apt-get update \
    # Install ODBC driver
    && ACCEPT_EULA=Y apt-get install -y msodbcsql18 \
    # Clean up
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Set the working directory in the container
WORKDIR /app

# Copy package files for dependency installation
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy the rest of the source code
COPY dist/ ./dist/
COPY .env.example ./

# Environment variables will be provided at runtime
# Required vars: MSSQL_HOST, MSSQL_PORT, MSSQL_USER, MSSQL_PASSWORD, MSSQL_DATABASE

# Expose port if needed (optional, depends on your configuration)
# EXPOSE 3000

# Start the server
CMD ["node", "dist/server.js"]