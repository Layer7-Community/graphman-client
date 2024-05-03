
const utils = require("./graphman-utils");
const butils = require("./graphman-bundle");
const opRevise = require("./graphman-operation-revise");
const graphman = require("./graphman");
const queryBuilder = require("./graphql-query-builder");
const preImportExtension = utils.extension("graphman-pre-bundle");

module.exports = {
    /**
     * Imports gateway configuration using a specified mutation.
     * @param params
     * @param params.using mutation
     * @param params.input name of the input file containing the gateway configuration as bundle
     * @param params.variables name-value pairs used in mutation
     * @param params.gateway name of the gateway profile
     * @param params.output name of the output file
     * @param params.options name-value pairs used to customize import operation
     */
    run: function (params) {
        if (!params.input) {
            throw "--input parameter is missing";
        }

        const gateway = graphman.gatewayConfiguration(params.gateway);
        if (!gateway.address) {
            throw utils.newError(`${gateway.name} gateway details are missing`);
        }

        if (!gateway.allowMutations && !params.options.force) {
            utils.warn(`${gateway.name} gateway is not opted for mutations, ignoring the operation`);
            utils.warn("  please consider either modifying the gateway profile in the graphman configuration or using the --force option");
            return;
        }

        const request = graphman.request(gateway, params.options);
        const inputBundle = butils.sanitize(utils.readFile(params.input), butils.IMPORT_USE, params.options);
        butils.removeDuplicates(inputBundle);
        butils.overrideMappings(inputBundle, params.options);

        const revisedBundle = params.options.revise ? opRevise.revise(inputBundle) : inputBundle;
        preImportExtension.call(revisedBundle);

        const query = queryBuilder.build(params.using, Object.assign(revisedBundle, params.variables), params.options);
        delete query.options;
        request.body = query;

        if (isPartsNeeded(revisedBundle)) {
            const boundary = "--------" + Date.now();
            request.parts = buildParts(revisedBundle, utils.parentPath(params.input));
            request.parts[0].boundary = boundary;
            request.headers["Content-Type"] = 'multipart/form-data; boundary='+boundary;
        }

        graphman.invoke(request, function (data) {
            utils.writeResult(params.output, sanitizeMutationResult(data));
        });
    },

    initParams: function (params, config) {
        params = Object.assign({
            using: "install-bundle",
            gateway: "default"
        }, params);

        params.options = Object.assign({
            bundleDefaultAction: "NEW_OR_UPDATE",
            excludeGoids: false,
            revise: false,
            force: false
        }, config.options, config.options.import, params.options);

        params.options.mappings = utils.mappings(params.options.mappings || {});

        const using = params.using;
        if (using === 'delete-bundle') {
            params.options.bundleDefaultAction = 'DELETE';
        } else if (params.options.bundleDefaultAction === 'DELETE') {
            utils.warn("DELETE action with the improper order of mutation operations may lead to failures");
        }

        return params;
    },

    usage: function () {
        console.log("import [--using <mutation>] --input <input-file> [--variables.<name> <value>,...]");
        console.log("  [--output <output-file>]");
        console.log("  [--options.<name> <value>,...]");
        console.log();
        console.log("Imports gateway configuration using a mutation-based query.");
        console.log("If no query is specified, it will be defaulted to the 'install-bundle' standard mutation-based query.");
        console.log();
        console.log("  --using <mutation>");
        console.log("    specify the name of mutation-based query");
        console.log();
        console.log("  --input <input-file>");
        console.log("    specify the name of input bundle file that contains gateway configuration");
        console.log();
        console.log("  --variables.<name> <value>");
        console.log("    specify the name-value pair(s) for the variables section of the mutation-based query");
        console.log();
        console.log("  --gateway <name>");
        console.log("    specify the name of gateway profile from the graphman configuration.");
        console.log("    when skipped, defaulted to the 'default' gateway profile.");
        console.log();
        console.log("  --output <output-file>");
        console.log("    specify the name of file to capture the result of the mutation.");
        console.log("    when skipped, output will be written to the console.");
        console.log();
        console.log("  --options.<name> <value>");
        console.log("    specify options as name-value pair(s) to customize the operation");
        console.log("      .comment <some-text>");
        console.log("        to leave the comment over the new policy revisions due to mutation");
        console.log("      .bundleDefaultAction <action>");
        console.log("        overrides the default mapping action at the bundle level.");
        console.log("      .mappings.action <action>");
        console.log("        overrides the mapping action for any entity.");
        console.log("      .mappings.<entity-type-plural-name>.action <action>");
        console.log("        overrides the mapping action for the specified class of entities. This option can be repeatable.");
        console.log("      .excludeGoids false|true");
        console.log("        use this option to exclude GOIDs from the importing bundled entities.");
        console.log("      .force false|true");
        console.log("        to force the operation even if the selected gateway profile is not designated for mutations.");
        console.log("      .revise false|true");
        console.log("        to revise the importing bundled entities (especially for matching the GOIDs) with respect to target gateway configuration.");
        console.log();
        console.log("    NOTE:");
        console.log("      Use 'delete-bundle' standard mutation-based query for deleting the entities.");
        console.log("      In the above, <action> refers to a valid entity mapping action.");
        console.log("      Permitted values are NEW_OR_UPDATE, NEW_OR_EXISTING, ALWAYS_CREATE_NEW, DELETE and IGNORE");
        console.log();
    }
}

function sanitizeMutationResult(originalResult) {
    let result = originalResult.data ? originalResult.data : originalResult;

    Object.keys(result).forEach(key => {
        if (Array.isArray(result[key].status) && !result[key].status.length) {
            delete result[key];
        }

        if (Array.isArray(result[key].detailedStatus) && !result[key].detailedStatus.length) {
            delete result[key];
        }
    });

    return originalResult;
}

function isPartsNeeded(bundle) {
    return Array.isArray(bundle.serverModuleFiles) && bundle.serverModuleFiles.length;
}

function buildParts(bundle, baseDir) {
    const parts = [{}];

    bundle.serverModuleFiles.forEach(smf => {
        let moduleFilename = smf.name + ".sjar";
        if (smf.properties) smf.properties.forEach(item => {
            if (item.name === "moduleFileName") moduleFilename = item.value;
        });

        if (!utils.existsFile(utils.path(baseDir, moduleFilename))) {
            let index = moduleFilename.lastIndexOf(".");
            let originalModuleFilename = moduleFilename;
            if (index !== -1 && moduleFilename.endsWith(".sjar")) moduleFilename = moduleFilename.substring(0, index) + ".jar";
            if (index !== -1 && moduleFilename.endsWith(".saar")) moduleFilename = moduleFilename.substring(0, index) + ".aar";
            if (!utils.existsFile(utils.path(baseDir, moduleFilename))) moduleFilename = originalModuleFilename;
        }

        const part = {
            name: smf.name,
            filename: moduleFilename,
            contentType: "application/octet-stream"
        };

        const filepath = utils.path(baseDir, moduleFilename);
        utils.info("building a part using " + filepath);
        part.data = utils.readFileBinary(filepath);
        utils.info("  part data length=" + part.data.length);
        parts.push(part);
    });

    return parts;
}
