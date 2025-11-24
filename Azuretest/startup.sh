#!/bin/bash

# Azure App Service startup script for Next.js
echo "Starting Next.js application..."
echo "Node.js version: $(node --version)"
echo "NPM version: $(npm --version)"

# Set default port if not provided
export PORT=${PORT:-3000}
echo "Using PORT: $PORT"

# Check if app.js exists
if [ ! -f "app.js" ]; then
    echo "Error: app.js not found!"
    echo "Current directory: $(pwd)"
    echo "Files in current directory:"
    ls -la
    exit 1
fi

echo "Starting app.js..."

# Start the application with error handling
exec node app.js