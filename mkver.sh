#!/bin/sh
## Usage: mkver.sh VERSION
## Creates a new version in versions/VERSION
## Example: mkver.sh 1.0

VERSION="$1"
NEW="versions/$VERSION/"
mkdir -p "$NEW"

# NOTE cp on Mac/BSD and Linux behaves differently
# DON'T add a trailing slash to the source directories
# or Mac/BSD will copy contents instead of the whole directory
cp -aR app extension utilities "$NEW" &&
    echo "Created $NEW"

# Update manifest files to point to the right version
sed -i '/"version":/s/:.*/: "'$VERSION'",/' $NEW/extension/manifest*.json

# Do popup files need updating too?
