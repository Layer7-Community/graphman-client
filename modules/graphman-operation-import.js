
const utils = require("./graphman-utils");
const butils = require("./graphman-bundle");
const opRevise = require("./graphman-operation-revise");
const graphman = require("./graphman");
const queryBuilder = require("./graphql-query-builder");
const PRE_BUNDLE_EXTN = utils.extension("graphman-pre-bundle");

module.exports = {
    run: function (params) {
        if (!params.input) {
            throw "Missing --input argument";
        }

        const config = graphman.configuration(params);

        if (!config.targetGateway) {
            throw "target gateway details are missing";
        }

        if (config.sourceGateway && config.sourceGateway.address === config.targetGateway.address) {
            if (!params.force) {
                utils.warn("source and target gateways cannot be the same, ignoring the operation");
                utils.warn("  please use --force option to override");
                return;
            }
        }

        const request = graphman.request(config.targetGateway);
        const inputBundle = butils.sanitize(utils.readFile(params.input), butils.IMPORT_USE, params.excludeGoids);
        butils.removeDuplicates(inputBundle);

        const using = params.using ? params.using : 'mutation';
        const revisedBundle = params.revise ? opRevise.revise(inputBundle) : inputBundle;

        PRE_BUNDLE_EXTN.call(revisedBundle);

        request.body = queryBuilder.build(using, Object.assign(revisedBundle, params.variables));

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

    usage: function () {
        console.log("    import [--using <query-id>] --input <input-file> [--variables.<name> <value>,...] [--output <output-file>] [<options>]");
        console.log("      --excludeGoids");
        console.log("        # use this option to exclude Goids from the importing bundled entities.");
        console.log("      --targetGateway.*");
        console.log("        # use this option(s) to override the target gateway details from the graphman configuration");
        console.log("      --revise");
        console.log("        # to revise the importing bundled entities (especially for matching the GOIDs) with respect to target gateway configuration");
        console.log("      --force");
        console.log("        # to force the import to the target gateway when source and target gateway details are found to be same");
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
