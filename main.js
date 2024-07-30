/*
 * Copyright ©  2024. Broadcom Inc. and/or its subsidiaries. All Rights Reserved.
 */

const GRAPHMAN_HOME = 'GRAPHMAN_HOME';
const GRAPHMAN_WORKSPACE = 'GRAPHMAN_WORKSPACE';
const args = process.argv.slice(2);
const op = args[0];

main();

/**
 * Entry point
 */
function main() {
    if (!process.env[GRAPHMAN_HOME]) {
        process.env[GRAPHMAN_HOME] = __dirname;
    }

    if (!process.env[GRAPHMAN_WORKSPACE]) {
        process.env[GRAPHMAN_WORKSPACE] = process.cwd();
    }

    const utils = require("./modules/graphman-utils");
    const graphman = require("./modules/graphman");

    try {
        const params = parse(args);
        params.options = params.options || {};

        // initialize configuration and schema metadata
        graphman.init(params);

        if (!op) {
            utils.error("operation is missing");
            utils.print("  supported operations:");
            graphman.supportedOperations().forEach(item => utils.print("    " + item));
            utils.print();
            utils.print("  usage: <operation> <parameter>,...");
            utils.print("  usage: <operation> --help");
            utils.print("  github: " + graphman.githubLink());
            utils.print();
        } else {
            let operation = findOperation(graphman, op);
            if (params.help) {
                operation.usage();
            } else {
                const config = graphman.configuration();
                utils.extensions(config.options.extensions);
                operation.run(operation.initParams(params, config));
            }
        }
    } catch (e) {
        if (typeof e === 'string') {
            utils.error(e);
            utils.print();
        } else if (typeof e === 'object' && e.name === 'GraphmanOperationError') {
            utils.error(e.message);
            utils.print();
        } else {
            utils.error("error encountered while processing the graphman operation");
            utils.error(`  name: ${e.name}`);
            utils.error(`  message: ${e.message}`);
            console.log(e);
            utils.print();
        }
    }
}

function findOperation(graphman, name) {
    if (!graphman.supportedOperations().includes(name)) {
        throw "unsupported operation: " + name;
    } else {
        return require("./modules/graphman-operation-" + name);
    }
}

function parse(args) {
    return require("./modules/args-parser").parse(args.slice(1));
}
