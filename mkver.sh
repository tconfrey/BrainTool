#!/bin/sh
# bundles up commands to create a new ~/versions subtree. Take in name, eg 0.8.0
echo creating versions/$1
mkdir versions/$1
mkdir versions/$1/app
mkdir versions/$1/extension
mkdir versions/$1/utilities
mkdir versions/$1/app/resources
mkdir versions/$1/extension/images
cp app/* versions/$1/app
cp extension/* versions/$1/extension/
cp utilities/* versions/$1/utilities/
cp app/resources/* versions/$1/app/resources
cp extension/images/* versions/$1/extension/images
