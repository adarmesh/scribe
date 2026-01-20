#!/bin/bash

# Script to zip all files except:
# 1. Directories starting with "Stepify"
# 2. .gitignore
# 3. git-related files

OUTPUT_NAME="extension.zip"

# Remove existing zip if present
rm -f "$OUTPUT_NAME"

# Create zip with exclusions
zip -r "$OUTPUT_NAME" . \
    -x "Stepify*" \
    -x ".git/*" \
    -x ".git" \
    -x ".gitignore" \
    -x "*.sh"

echo "Created $OUTPUT_NAME"
