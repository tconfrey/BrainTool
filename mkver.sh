#!/bin/sh
## Usage: mkver.sh VERSION
## Creates a new version in versions/VERSION
## Example: mkver.sh 1.0

VERSION="$1"
OUT="versions/$VERSION/"
mkdir -p "$OUT"

# copy whole folders, deleting anything added to $OUT
rsync -a --delete app extension utilities "$OUT"

# Update manifest files to point to the right version
sed -i '/"version":/s/:.*/: "'$VERSION'",/' $OUT/extension/manifest*.json

# Do popup files need updating too?
