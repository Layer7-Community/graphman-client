/*
 * Copyright ©  2024. Broadcom Inc. and/or its subsidiaries. All Rights Reserved.
 */

const utils = require("./graphman-utils");
const butils = require("./graphman-bundle");
const graphman = require("./graphman");
const gql = require("./graphql-query");

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

        if (!gateway.allowMutations) {
            utils.warn(`${gateway.name} gateway is not opted for mutations, ignoring the operation`);
            utils.warn("  make sure the gateway profile is ready for mutations (.allowMutations=true)");
            utils.print();
            return;
        }

        let inputBundle = butils.sanitize(utils.readFile(params.input), butils.IMPORT_USE, params.options);
        inputBundle = butils.removeDuplicates(inputBundle);
        butils.overrideMappings(inputBundle, params.options);
        inputBundle = utils.extension("pre-import").apply(inputBundle, params.options);

        const query = gql.generate(params.using, Object.assign(inputBundle, params.variables), params.options);
        const request = graphman.request(gateway, query.options);
        delete query.options;
        request.body = query;

        if (isPartsNeeded(inputBundle)) {
            const boundary = "--------" + Date.now();
            request.parts = buildParts(inputBundle, utils.parentPath(params.input));
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
            comment: null,
            bundleDefaultAction: null,
            excludeGoids: false,
            forceDelete: false,
            forceAdminPasswordReset: false,
            replaceAllMatchingCertChain: false
        }, config.options, params.options);

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
        console.log("  [--gateway <name>]");
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
        console.log("      .bundleDefaultAction <action>");
        console.log("        overrides the default mapping action at the bundle level.");
        console.log("      .mappings.action <action>");
        console.log("        overrides the mapping action for any entity.");
        console.log("      .mappings.<entity-type-plural-name>.action <action>");
        console.log("        overrides the mapping action for the specified class of entities. This option can be repeatable.");
        console.log("      .excludeGoids false|true");
        console.log("        use this option to exclude GOIDs from the importing bundled entities.");
        console.log("      .comment <some-text>");
        console.log("        to leave the comment over the new policy revisions due to mutation");
        console.log("      .forceDelete false|true");
        console.log("        to force deleting the entities when required.");
        console.log("      .forceAdminPasswordReset false|true");
        console.log("        to force modifying the admin user's password.");
        console.log("      .replaceAllMatchingCertChain false|true");
        console.log("        to replace all matching cert chain for the keys when required.");
        console.log("      .overrideReplaceRoleAssignees undefined|false|true");
        console.log("        when specified, to override replaceRoleAssignees flag over the role entities.");
        console.log("      .overrideReplaceUserGroupMemberships undefined|false|true");
        console.log("        when specified, to override replaceMemberships flag over the user/group entities.");
        console.log("      .migratePolicyRevisions false|true");
        console.log("        to migrate the policies and services along with their revisions.");
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
