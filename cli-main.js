/*
 * Copyright ©  2024. Broadcom Inc. and/or its subsidiaries. All Rights Reserved.
 */

const module = process.env.GRAPHMAN_MODULE || "@layer7/graphman";
const home = process.env.GRAPHMAN_HOME || __dirname;
const args = process.argv.slice(2);
const op = args[0];
const fs = require("fs");

if (fs.existsSync(home + "/modules/main.js")) {
    // running the client from cloned repo
    require("./modules/main")
        .call(home, op, args);
} else {
    //running the client using npm module
    graphman(module)
        .call(home, op, args);
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
