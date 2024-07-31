/*
 * Copyright ©  2024. Broadcom Inc. and/or its subsidiaries. All Rights Reserved.
 */

const GRAPHMAN_HOME = 'GRAPHMAN_HOME';
const GRAPHMAN_WORKSPACE = 'GRAPHMAN_WORKSPACE';
const args = process.argv.slice(2);
const op = args[0];

if (!process.env[GRAPHMAN_HOME]) {
    process.env[GRAPHMAN_HOME] = __dirname;
}

const graphman = require("@layer7/graphman");
graphman.init({workspace: process.env[GRAPHMAN_WORKSPACE] || process.cwd()});
graphman.call(op, args);
