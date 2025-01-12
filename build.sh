#!/bin/bash
# build.sh - Script to build and prepare the application for deployment

# Exit on error
set -e

# Step 1: Create the build directory (if it doesn't exist)
echo "Creating build directory..."
mkdir -p build

# Step 2: Install Python dependencies
echo "Installing dependencies..."
pip install --upgrade pip
pip install -r requirements.txt

# Step 3: Copy necessary files to the build directory
echo "Copying files to build directory..."
cp -r app.py wsgi.py requirements.txt config.py .env app/ static/ templates/ Controller/ Model/ build/

# Step 4: Verify the build directory
echo "Build directory contents:"
ls -la build

# Step 5: Print success message
echo "Build completed successfully!"