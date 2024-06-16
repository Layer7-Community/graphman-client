
const utils = require("./graphman-utils");
const graphman = require("./graphman");
const gql = require("./graphql-query");

module.exports = {
    /**
     * Describes queries
     * @param params
     * @param params.query query name
     * @param params.queries
     */
    run: function (params) {
        if (!params.query) {
            throw "--query parameters are missing";
        }

        if (typeof params.query === 'object') {
            printAvailableQueries();
        } else {
            describeQuery(params.query);
        }
    },

    initParams: function (params, config) {
        // do nothing
        return params;
    },

    usage: function () {
        console.log("describe --query [<query-name>]]");
        console.log("  [--output <output-file>]");
        console.log();
        console.log("Describes queries about their fields, arguments, etc.");
        console.log();
        console.log("  --query <query-name>");
        console.log("    specify query name with/without wild-cards");
        console.log("    when no query name is specified, it lists out all the available queries")
        console.log();
        console.log("  --output <output-file>");
        console.log("    specify the file to capture the important part of the described result");
        console.log();
    }
}

function isMutationBasedQuery(path) {
    if (utils.existsFile(path)) {
        return utils.readFile(path).trim().startsWith("mutation");
    }
}

function availableQueries(callback) {
    utils.listDir(utils.queriesDir()).forEach(item => {
        if (item.endsWith(".json")) {
            const name = item.substring(0, item.length - 5);
            const isMutation = isMutationBasedQuery(utils.path(utils.queriesDir(), name + ".gql"));
            callback(name, isMutation);
        }
    });
}

function describeQuery(queryName) {
    utils.info("query", queryName);
    if (queryName.indexOf("*") === -1) {
        const query = gql.generate(queryName, {}, {describeQuery: true});
        utils.print(query.query);
    } else {
        const queryNames = graphman.queryFieldNamesByPattern(queryName);
        if (queryNames.length === 0) {
            utils.info("no matches found");
        } else if (queryNames.length === 1) {
            const query = gql.generate(queryNames[0], {}, {describeQuery: true});
            utils.print(query.query);
        } else {
            utils.info(`${queryNames.length} matches found`);
            Array.from(queryNames).forEach(item => utils.print(`         ${item}`));
        }
    }
    utils.print();
}

function printAvailableQueries() {
    utils.info("available queries:");
    const mutations = [];
    availableQueries((name, isMutation) => {
        if (!isMutation) utils.print(`         ${name}`);
        else mutations.push(name);
    });
    utils.print();

    utils.info("available mutations:");
    Array.from(mutations).forEach(name => utils.print(`         ${name}`));
    utils.print();

    utils.info("available in-built queries:");
    const metadata = graphman.schemaMetadata();
    metadata.types["Query"].fields.forEach(fieldInfo => {
        utils.print(`         ${fieldInfo.name}`);
    });
    utils.print();
}
