#!/usr/bin/env node

/*
 * Copyright ©  2024. Broadcom Inc. and/or its subsidiaries. All Rights Reserved.
 */

const home = process.env.GRAPHMAN_HOME || require("path").resolve(".");
const args = process.argv.slice(2);
const op = args[0];

require("./modules/main")
    .call(home, op, args);
