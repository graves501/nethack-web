#!/bin/sh

godot --export-debug Web
cp lib/* build

sudo mkdir -p /srv/http/nethack
sudo cp build/* /srv/http/nethack