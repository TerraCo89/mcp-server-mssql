# Use an official Python runtime as a parent image
FROM python:3.10-slim

# Set environment variables to prevent interactive prompts during package installation
ENV DEBIAN_FRONTEND=noninteractive

# Install ODBC driver dependencies and the driver itself (Debian/Ubuntu example)
# Adjust based on your specific driver and base image OS
RUN apt-get update \
    # Install lsb-release first to determine Debian version
    && apt-get install -y --no-install-recommends lsb-release gnupg2 curl apt-transport-https \
    # Add Microsoft GPG key securely
    && curl https://packages.microsoft.com/keys/microsoft.asc | gpg --dearmor > /etc/apt/trusted.gpg.d/microsoft.gpg \
    # Add Microsoft repository
    && echo "deb [arch=amd64] https://packages.microsoft.com/debian/$(lsb_release -rs)/prod $(lsb_release -cs) main" > /etc/apt/sources.list.d/mssql-release.list \
    # Update package list again after adding repo
    && apt-get update \
    # Install ODBC driver and unixODBC development headers
    && ACCEPT_EULA=Y apt-get install -y msodbcsql17 unixodbc-dev \
    # Clean up APT cache
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Set the working directory in the container
WORKDIR /app

# Copy the requirements file into the container at /app
COPY requirements.txt /app/

# Install any needed packages specified in requirements.txt
# Use --no-cache-dir to reduce image size
RUN pip install --no-cache-dir -r requirements.txt

# Copy the server script into the container at /app
COPY server.py /app/
COPY profiles.json /app/ 
# Copy profiles file (can be empty)

# Make port 80 available to the world outside this container (if needed, MCP stdio doesn't use ports)
# EXPOSE 80

# --- Keyring Configuration ---
# Create directory for keyring data
RUN mkdir /keyring_data && chown nobody:nogroup /keyring_data

# Set environment variables for keyring cryptfile backend
# IMPORTANT: KEYRING_CRYPTFILE_PASSWORD should be set securely at runtime (e.g., via Docker secrets or --env-file)
# Do NOT hardcode the actual password here.
ENV PYTHON_KEYRING_BACKEND=keyrings.cryptfile.CryptFileKeyring
ENV KEYRING_CRYPTFILE_PASSWORD="your_secret_password_placeholder"
ENV KEYRING_CRYPTFILE_DATA_PATH=/keyring_data/keyring_pass.cfg

# Declare volume for keyring data persistence
VOLUME /keyring_data

# Run server.py when the container launches
CMD ["python", "server.py"]