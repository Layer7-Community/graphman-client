#!/bin/sh

if [ -z "$GRAPHMAN_HOME" ]; then
  echo "GRAPHMAN_HOME environment variable is not defined"
  exit 1
fi

node "$GRAPHMAN_HOME/cli-main.js" "$@"
