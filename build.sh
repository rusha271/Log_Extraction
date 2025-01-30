#!/bin/bash

# Get the base directory of the script
BASE_DIR=$(dirname $(realpath $0))

# Activate the virtual environment
source $BASE_DIR/venv/bin/activate

# Clean up previous build directories
echo "Cleaning up previous build directories..."
rm -rf $BASE_DIR/dist $BASE_DIR/build

# Build the executable using PyInstaller
echo "Building the executable..."
pyinstaller --name=MyFlaskApp \
            --add-data "$BASE_DIR/Flask/templates:app/templates" \
            --add-data "$BASE_DIR/Flask/static:app/static" \
            --add-data "$BASE_DIR/Flask/Controller:app/Controller" \
            --add-data "$BASE_DIR/Flask/Model:app/Model" \
            $BASE_DIR/app.py

# Copy additional configuration files
echo "Copying configuration files..."
cp $BASE_DIR/.env $BASE_DIR/dist/MyFlaskApp/
cp $BASE_DIR/config.py $BASE_DIR/dist/MyFlaskApp/

# Instructions for the user
echo "Build completed. Executable is in dist/MyFlaskApp/"
echo "To run the application, navigate to dist/MyFlaskApp/ and execute ./MyFlaskApp"