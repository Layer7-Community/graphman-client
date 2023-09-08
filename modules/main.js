
const GRAPHMAN_HOME = 'GRAPHMAN_HOME';
const SUPPORTED_OPERATIONS = ["export", "import", "explode", "implode", "combine", "diff", "renew", "revise", "schema"];
const GRAPHMAN_OPERATION_MODULE_PREFIX = "./graphman-operation-";
const args = process.argv.slice(2);
const op = args[0];
const utils = require("./graphman-utils");
const graphman = require("./graphman");

try {
    init();

    const params = parse(args);
    utils.logAt(params.log);

    // initialize configuration and schema metadata
    graphman.init(params);

    if (!op || op === "help") {
        require("./help").run(params, SUPPORTED_OPERATIONS);
    } else {
        operation(op).run(params);
    }
} catch (e) {
    if (typeof e !== 'object') {
        console.log(e);
    } else if (utils.loggingAt('debug')) {
        console.log(e);
    } else {
        console.log("error encountered while processing the graphman operation, " + `${e.name}, ${e.message}` );
    }
}

function init() {
    if (!process.env[GRAPHMAN_HOME]) {
        throw GRAPHMAN_HOME + " environment variable is not defined";
    }
}

function operation(name) {
    if (!SUPPORTED_OPERATIONS.includes(name)) {
        throw "unsupported operation: " + name;
    } else {
        return require(GRAPHMAN_OPERATION_MODULE_PREFIX + name);
    }
}

function parse(args) {
    return require("./args-parser").parse(args.slice(1));
}
