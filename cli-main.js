/*
 * Copyright ©  2024. Broadcom Inc. and/or its subsidiaries. All Rights Reserved.
 */

const home = process.env.GRAPHMAN_HOME || __dirname;
const args = process.argv.slice(2);
const op = args[0];
graphman("@layer7/graphman")
    .call(home, op, args);

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
        console.log("please refer the github link for installation: https://github.com/Layer7-Community/graphman-client")
        console.log();
    }

    return {call: function (){}};
}
