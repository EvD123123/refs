#!/bin/bash

# Install Node.js dependencies
npm install

# Download yt-dlp binary
curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o yt-dlp
chmod +x yt-dlp

# Move to a location in PATH
mkdir -p /opt/render/project/.render/bin
mv yt-dlp /opt/render/project/.render/bin/

echo "Build complete! yt-dlp installed."
