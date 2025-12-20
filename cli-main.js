#!/usr/bin/env node

// Copyright (c) 2025 Broadcom Inc. and its subsidiaries. All Rights Reserved.

const home = process.env.GRAPHMAN_HOME || __dirname;
const args = process.argv.slice(2);
const op = args[0];

require("./modules/main")
    .call(home, op, args);
