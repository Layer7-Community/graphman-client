
const utils = require("./graphman-utils");
const butils = require("./graphman-bundle");
const graphman = require("./graphman");
const POST_BUNDLE_EXTN = utils.extension("graphman-post-bundle");

module.exports = {
    run: function (params) {
        const queryBuilder = require("./graphql-query-builder");
        const config = graphman.configuration(params);

        if (!config.sourceGateway) {
            throw "source gateway details are missing";
        }

        adjustParameters(params);

        let startDate = Date.now();
        this.export(
            config.sourceGateway,
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
        console.log("      --mappingAction <entity-type-plural-tag>:<action>");
        console.log("        # mapping action for the specified class of entities. This option can be repeatable.");
        console.log("      --defaultMappingAction <entity-type-plural-tag>:<action>");
        console.log("        # default mapping action for the specified class of entities. This option can be repeatable.");
        console.log("      --dependencyMappingAction <entity-type-plural-tag>:<action>");
        console.log("        # dependency mapping action for the specified class of entities. This option can be repeatable.");

        console.log("      --excludeDependencies");
        console.log("        # use this option to exclude dependency entities from the exported bundled entities.");
        console.log("      --excludeGoids");
        console.log("        # use this option to exclude Goids from the exported bundled entities.");
        console.log("      --policyAsYaml");
        console.log("        # use this option to export policy in YAML format.");
        console.log("      --sourceGateway.*");
        console.log("        # use this option(s) to override the source gateway details from the graphman configuration");
    }
}

function adjustParameters(params) {
    // TODO: any better way to handle these customizations
    params.variables = params.variables || {};
    params.options = params.options || {};

    if (params.using && (params.using === "encass" || params.using.startsWith("encass:")) && params.variables) {
        params.variables.policyName = params.variables.policyName || params.variables.name;
    }

    if (params.policyAsYaml) {
        params.variables.policyAsYaml = true;
    }

    params.options.bundleDefaultAction = params.bundleDefaultAction || "NEW_OR_UPDATE";
    params.options.bundleMappingsLevel = params.bundleMappingsLevel || "0";
    params.options.mappingActions = utils.mappingActions(
        params.defaultMappingAction,
        params.mappingAction,
        params.dependencyMappingAction,
        params.options.bundleDefaultAction
    );
    params.options.mappingActions['default'] = {
        defaultAction: params.options.bundleDefaultAction,
        action: params.options.bundleDefaultAction,
        dependencyAction: params.options.bundleDefaultAction
    };

    if (params.excludeDependencies) {
        params.options.excludeDependencies = true;
    }

    if (params.excludeGoids) {
        params.options.excludeGoids = true;
    }
}

function buildQueryParameters(options) {
    let queryParams = "";

    if (options) {
        if (options.bundleDefaultAction) queryParams += "&bundleDefaultAction=" + options.bundleDefaultAction;
        if (options.bundleMappingsLevel) queryParams += "&bundleMappingsLevel=" + options.bundleMappingsLevel;
    }

    return queryParams.length > 1 ? "?" + queryParams.substring(1) : "";
}
