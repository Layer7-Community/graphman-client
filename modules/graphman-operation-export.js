
const utils = require("./graphman-utils");
const butils = require("./graphman-bundle");
const graphman = require("./graphman");
const POST_BUNDLE_EXTN = utils.extension("graphman-post-bundle");

module.exports = {
    run: function (params) {
        const queryBuilder = require("./graphql-query-builder");
        const config = graphman.configuration();
        const gateway = graphman.gatewayConfiguration(params.gateway) ||
            graphman.overridenGatewayConfiguration(params.sourceGateway) ||
            config.defaultGateway;

        if (!gateway.address) {
            throw utils.newError(`${gateway.name} gateway details are missing`);
        }

        adjustParameters(params, config);

        let startDate = Date.now();
        this.export(
            gateway,
            queryBuilder.build(params.using ? params.using : 'all', params.variables, params.options),
            (data, parts) => {
                let endDate = Date.now();

                if (data.data) {
                    data = butils.sanitize(data.data, butils.EXPORT_USE, params.options);
                    butils.removeDuplicates(data);
                    butils.filter(data, params.filter);
                    POST_BUNDLE_EXTN.call(data, parts);
                    utils.writeResult(params.output, butils.sort(data));
                    if (parts) utils.writePartsResult(utils.parentPath(params.output), parts);

                    if (data.errors) {
                        utils.warn("errors detected", data.errors);
                    }
                } else {
                    utils.info("unexpected data", data);
                }

                utils.fine("start time: " + startDate);
                utils.fine("end time: " + endDate);
                utils.fine("total time: " + (endDate - startDate));
            }
        );
    },

    export: function (gateway, query, callback) {
        if (!query.query.startsWith("query")) {
            utils.info("invalid query for export operation", query);
            throw "invalid query for export operation";
        }

        utils.info(`exporting from ${gateway.name||gateway.address} gateway`);
        const request = graphman.request(gateway);
        request.path += buildQueryParameters(query.options);
        request.body = query;
        graphman.invoke(request, callback);
    },

    usage: function () {
        console.log("    export --using <query-id> [--variables.<name> <value>,...] [--filter.by <entity-field-name> --filter.<matching-criteria> <value>,...] [--output <output-file>] [<options>]");
        console.log("        # use <entity-type-plural-tag> as query-id for listing the entities. If not specified, it will be defaulted to all.");
        console.log("      --filter.by");
        console.log("        # use this option to filter the exported entities by some field.");
        console.log("      --filter.equals|startsWith|endsWith|contains");
        console.log("        # use this option to choose the matching criteria to filter the exported entities.");

        console.log("      --bundleDefaultAction <action>");
        console.log("        # default mapping action at the bundle level.");

        console.log("      --excludeDependencies");
        console.log("        # use this option to exclude dependency entities from the exported bundled entities.");
        console.log("      --excludeGoids");
        console.log("        # use this option to exclude Goids from the exported bundled entities.");
        console.log("      --gateway <name>");
        console.log("        # specify the name of gateway profile from the graphman configuration");
        console.log("      --sourceGateway.*");
        console.log("        # (DEPRECATED, use --gateway option) use this option(s) to override the source gateway details from the graphman configuration");
    }
}

function adjustParameters(params, config) {
    // TODO: any better way to handle these customizations
    params.variables = params.variables || {};
    params.options = params.options || {};

    if (params.using && (params.using === "encass" || params.using.startsWith("encass:")) && params.variables) {
        params.variables.policyName = params.variables.policyName || params.variables.name;
    }

    params.options.bundleDefaultAction = params.bundleDefaultAction;
    params.options.bundleMappingsLevel = 0;
    params.options.mappings = utils.mappings({} || params.mappings);

    if (params.excludeDependencies) {
        params.options.excludeDependencies = true;
    }

    if (params.excludeGoids) {
        params.options.excludeGoids = true;
    }

    if (!params.options.policyCodeFormat) {
        params.options.policyCodeFormat = config.options.policyCodeFormat;
    }

    if (!params.options.keyFormat) {
        params.options.keyFormat = config.options.keyFormat;
    }
}

function buildQueryParameters(options) {
    let queryParams = "";
    let separator = "?";

    if (options) {
        if (options.bundleMappingsLevel >= 0) {
            queryParams += separator + "bundleMappingsLevel=" + options.bundleMappingsLevel;
            separator = "&";
        }
    }

    return queryParams;
}
