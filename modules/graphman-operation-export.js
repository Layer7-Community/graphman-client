
const utils = require("./graphman-utils");
const butils = require("./graphman-bundle");
const graphman = require("./graphman");
const queryBuilder = require("./graphql-query-builder");
const postExportExtension = utils.extension("graphman-post-bundle");

module.exports = {
    /**
     * Exports gateway configuration using a specified query. If the query doesn't exist, client tries to generate a query dynamically.
     * @param params
     * @param params.using query
     * @param params.variables name-value pairs used in querying the configuration
     * @param params.gateway name of the gateway profile
     * @param params.output name of the output file
     * @param params.filter used to filter the exported configuration
     * @param params.options name-value pairs used to customize export operation
     */
    run: function (params) {
        const gateway = graphman.gatewayConfiguration(params.gateway);

        if (!gateway.address) {
            throw utils.newError(`${gateway.name} gateway details are missing`);
        }

        const query = queryBuilder.build(params.using, params.variables, params.options);
        const startDate = Date.now();

        utils.fine("start time: " + startDate);
        this.export(gateway, query, (data, parts) => {
            const endDate = Date.now();
            onExportDataCallback(data, parts, params);
            utils.fine("end time: " + endDate);
            utils.fine("operation completed in " + (endDate - startDate) + " milliseconds");
        });
    },

    export: function (gateway, query, callback) {
        if (!query.query.startsWith("query")) {
            utils.info("invalid query for export operation", query);
            throw "invalid query for export operation";
        }

        utils.info(`exporting from ${gateway.name||gateway.address} gateway`);
        const request = graphman.request(gateway, query.options);
        delete query.options;
        request.body = query;
        graphman.invoke(request, callback);
    },

    initParams: function (params, config) {
        params = Object.assign({
            using: "all",
            gateway: "default"
        }, params);

        params.variables = params.variables || {};
        params.options = Object.assign({
            bundleDefaultAction: "NEW_OR_UPDATE",
            bundleMappingsLevel: 0,
            excludeDependencies: false,
            excludeGoids: false
        }, config.options, config.options.export, params.options);

        params.options.mappings = utils.mappings({});

        if (params.using === "encass" || params.using.startsWith("encass:")) {
            params.variables.policyName = params.variables.policyName || params.variables.name;
        }

        return params;
    },

    usage: function () {
        console.log("export --using <query> [--variables.<name> <value>,...] [--gateway <name>]");
        console.log("  [--output <output-file>]");
        console.log("  [--filter.by <entity-field-name> --filter.<matching-criteria> <value>,...]");
        console.log("  [--options.<name> <value>,...]");
        console.log();
        console.log("Exports gateway configuration using a specified query. If the query doesn't exist, client tries to generate a query dynamically.");
        console.log("If no query is specified, it will be defaulted to the 'all' query.");
        console.log();
        console.log("  --using <query>");
        console.log("    specify the name of query used to export");
        console.log();
        console.log("  --variables.<name> <value>");
        console.log("    specify the name-value pair(s) for the variables section of the query used to export");
        console.log();
        console.log("  --gateway <name>");
        console.log("    specify the name of gateway profile from the graphman configuration.");
        console.log("    when skipped, defaulted to the 'default' gateway profile.");
        console.log();
        console.log("  --output <output-file>");
        console.log("    specify the name of file to capture the exported configuration.");
        console.log("    when skipped, output will be written to the console.");
        console.log();
        console.log("  --filter.by <field-name>");
        console.log("    use this option to filter the exported entities by some field");
        console.log();
        console.log("  --filter.[equals|startsWith|endsWith|contains] <value>");
        console.log("    use this option to choose the matching criteria to filter the exported entities");
        console.log();
        console.log("  --options.<name> <value>");
        console.log("    specify options as name-value pair(s) to customize the operation");
        console.log("      .bundleDefaultAction <action>");
        console.log("        default mapping action at the bundle level.");
        console.log("      .excludeDependencies false|true");
        console.log("        use this option to exclude dependency entities from the exported bundled entities.");
        console.log("      .excludeGoids false|true");
        console.log("        use this option to exclude Goids from the exported bundled entities.");
        console.log();
    }
}

function onExportDataCallback(data, parts, params) {
    if (data.data) {
        data = butils.sanitize(data.data, butils.EXPORT_USE, params.options);
        butils.removeDuplicates(data);
        butils.filter(data, params.filter);
        postExportExtension.call(data, parts);
        utils.writeResult(params.output, butils.sort(data));
        if (parts) utils.writePartsResult(utils.parentPath(params.output), parts);

        if (data.errors) {
            utils.warn("errors detected", data.errors);
        }
    } else {
        utils.info("unexpected data", data);
    }
}
