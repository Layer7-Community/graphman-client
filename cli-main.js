/*
 * Copyright ©  2024. Broadcom Inc. and/or its subsidiaries. All Rights Reserved.
 */

const l7Module = process.env.GRAPHMAN_MODULE || "@layer7/graphman";
const l7Home = process.env.GRAPHMAN_HOME || __dirname;
const args = process.argv.slice(2);
const op = args[0];
const fs = require("fs");

if (fs.existsSync(l7Home + "/modules/main.js")) {
    // running the client from cloned repo
    require("./modules/main")
        .call(l7Home, op, args);
} else {
    //running the client using npm module
    graphman(l7Module)
        .call(l7Home, op, args);
}

function graphman(module) {
    try {
        return require(module);
    } catch (e) {
        if (e.code !== 'MODULE_NOT_FOUND') {
            console.log("unexpected error encountered, " + e.message);
            console.log(e);
            console.log();
        }

        console.log(module + " npm module is not available");
        console.log("please refer the github link for [Getting Started with the CLI]: https://github.com/Layer7-Community/graphman-client?tab=readme-ov-file#cli")
        console.log();
    }

    return {call: function (){}};
}
