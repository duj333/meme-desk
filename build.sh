#!/bin/bash
# Stamp sw.js with a hash of the app shell so phones pick up any change on next open.
cd "$(dirname "$0")"
H=$(cat index.html app.js app.css config.js manifest.webmanifest icons/*.png | sha256sum | cut -c1-12)
sed -i -E "s/^const BUILD = \"[^\"]*\";/const BUILD = \"$H\";/" sw.js
echo "BUILD=$H"
