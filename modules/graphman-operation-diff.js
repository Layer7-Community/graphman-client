
const graphman = require("./graphman");
const utils = require("./graphman-utils");
const butils = require("./graphman-bundle");
const queryBuilder = require("./graphql-query-builder");
const opExport = require("./graphman-operation-export");

module.exports = {
    run: function (params) {
        const bundles = [];

        if (Array.isArray(params.input) && params.input.length >= 2) {
            bundles.push(readBundleFrom(params.input[0]));
            bundles.push(readBundleFrom(params.input[1]));
        } else {
            throw utils.newError("not enough arguments")
        }

        Promise.all(bundles).then(results => {
            const leftBundle = results[0];
            const rightBundle = results[1];
            const diffBundle = {goidMappings: [], guidMappings: []};

            diff(leftBundle, rightBundle, diffBundle);
            if (!diffBundle.goidMappings.length) delete diffBundle.goidMappings;
            if (!diffBundle.guidMappings.length) delete diffBundle.guidMappings;

            diffBundle.properties = leftBundle.properties;
            utils.writeResult(params.output, butils.sort(diffBundle));
        });
    },

    usage: function () {
        console.log("    diff [--input <input-file-or-gateway> --input <input-file-or-gateway>] [--output <output-file>] [<options>]");
        console.log("        # evaluates the differences between bundles or gateways.");
        console.log("        # input can be a bundle file or a gateway name if it precedes with '@' special character.");
        console.log("        # when gateway is specified as input, summary bundle will be pulled for comparison.");
    }
}

function readBundleFrom(fileOrGateway) {
    if (fileOrGateway.startsWith('@')) {
        const gateway = graphman.gatewayConfiguration(fileOrGateway.substring(1));
        if (!gateway.address) throw utils.newError(`${gateway.name} gateway details are missing`);
        return readBundleFromGateway(gateway);
    } else {
        return new Promise(function (resolve) {
            resolve(utils.readFile(fileOrGateway));
        });
    }
}

function readBundleFromGateway(gateway) {
    return new Promise(function (resolve) {
        utils.info(`retrieving ${gateway.name} gateway configuration summary`);
        opExport.export(
            gateway,
            queryBuilder.build("summary", {}, graphman.configuration().options),
            data => resolve(data.data)
        );
    });
}

function diff(leftBundle, rightBundle, resultBundle) {
    Object.keys(leftBundle).forEach(key => {
        if (Array.isArray(leftBundle[key])) {
            utils.info("inspecting " + key);
            resultBundle[key] = resultBundle[key]||[];
            diffEntities(leftBundle[key], rightBundle[key]||[], resultBundle[key], resultBundle, key);
            if (resultBundle[key].length === 0) {
                delete resultBundle[key];
            }
        }
    });

    return resultBundle;
}

function diffEntities(leftEntities, rightEntities, resultEntities, resultBundle, key) {
    leftEntities.forEach(left => {
        const matchingEntity = butils.findMatchingEntity(rightEntities, left);

        if (!matchingEntity) {
            utils.info("  selecting " + butils.entityDisplayName(left));
            resultEntities.push(left);
        } else if (matchingEntity.checksum != null && matchingEntity.checksum !== left.checksum) { // if matchingEntity.checksum is not present, we assume user explicitely wants to ignore same entity that have different value
            utils.info("  selecting " + butils.entityDisplayName(left));
            resultEntities.push(left);
        }

        if (matchingEntity) {
            if (butils.GOID_MAPPING_PLURAL_METHODS.includes(key) && left.goid && matchingEntity.goid !== left.goid) {
                utils.info(`  required goid mapping for ` + butils.entityDisplayName(left) + `, source: ${left.goid}, target: ${matchingEntity.goid}`);
                resultBundle.goidMappings.push({source: left.goid, target: matchingEntity.goid});
            }

            if ((key === 'policyFragments' || key === "encassConfigs") && left.guid && matchingEntity.guid !== left.guid) {
                utils.info(`  required guid mapping for ` + butils.entityDisplayName(left) + `, source: ${left.guid}, target: ${matchingEntity.guid}`);
                resultBundle.guidMappings.push({source: left.guid, target: matchingEntity.guid});
            }
        }
    });

    rightEntities.forEach(right => {
        if (leftEntities.every(left => !butils.matchEntity(left, right))) {
            utils.info("  (opt) marking the target entity for deletion " + butils.entityDisplayName(right));
        }
    });
}
