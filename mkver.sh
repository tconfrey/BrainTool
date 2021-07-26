#!/bin/sh
# bundles up commands to create a new ~/versions subtree. Take in name, eg 0.8.0
echo creating versions/$1
mkdir versions/$1
mkdir versions/$1/app
mkdir versions/$1/extension
mkdir versions/$1/utilities
mkdir versions/$1/app/resources
mkdir versions/$1/extension/images
mkdir versions/$1/extension/_locales
mkdir versions/$1/extension/_locales/de
mkdir versions/$1/extension/_locales/en
mkdir versions/$1/extension/_locales/es
mkdir versions/$1/extension/_locales/fr
cp app/* versions/$1/app
cp extension/* versions/$1/extension/
cp utilities/* versions/$1/utilities/
cp app/resources/* versions/$1/app/resources
cp extension/images/* versions/$1/extension/images
cp extension/_locales/* versions/$1/extension/_locales
cp extension/_locales/de/* versions/$1/extension/_locales/de
cp extension/_locales/en/* versions/$1/extension/_locales/en
cp extension/_locales/es/* versions/$1/extension/_locales/es
cp extension/_locales/fr/* versions/$1/extension/_locales/fr

echo "Don't forget to update the manifest and popup files to point to the right version!"
