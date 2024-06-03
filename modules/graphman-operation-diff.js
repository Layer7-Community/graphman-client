
const graphman = require("./graphman");
const utils = require("./graphman-utils");
const butils = require("./graphman-bundle");
const queryBuilder = require("./graphql-query-builder");
const opExport = require("./graphman-operation-export");

module.exports = {
    /**
     * Identifies the differences between bundles/gateways.
     * @param params
     * @param params.input bundle or gateway profile name
     * @param params.output output file name
     * NOTE: Use "@" as prefix to differentiate the gateway profile name from the bundle name.
     */
    run: function (params) {
        const bundles = [];

        if (Array.isArray(params.input) && params.input.length >= 2) {
            bundles.push(readBundleFrom(params.input[0]));
            bundles.push(readBundleFrom(params.input[1]));
        } else {
            throw utils.newError("not enough input parameters")
        }

        Promise.all(bundles).then(results => {
            const leftBundle = results[0];
            const rightBundle = results[1];
            const diffBundle = {goidMappings: [], guidMappings: []};

            console.log("params"+JSON.stringify(params,null,4));
            if (params.options && params.options.fullDiff){
                diffBundle["updates"] = {};
                diffBundle["inserts"] = {};
                diffBundle["deletes"] = {};
            }

            diff(leftBundle, rightBundle, diffBundle);
            if (!diffBundle.goidMappings.length)                               delete diffBundle.goidMappings;
            if (!diffBundle.guidMappings.length)                               delete diffBundle.guidMappings;
            if (diffBundle.updates && !Object.keys(diffBundle.updates).length) delete diffBundle.updates;
            if (diffBundle.inserts && !Object.keys(diffBundle.inserts).length) delete diffBundle.inserts;
            if (diffBundle.deletes && !Object.keys(diffBundle.deletes).length) delete diffBundle.deletes;

            diffBundle.properties = leftBundle.properties;
            utils.writeResult(params.output, butils.sort(diffBundle));
        });
    },

    initParams: function (params, config) {
        //do nothing
        return params;
    },

    usage: function () {
        console.log("diff --input <input-file-or-gateway> --input <input-file-or-gateway>");
        console.log("  [--output <output-file>]");
        console.log();
        console.log("Evaluates the differences between bundles or gateways.");
        console.log("Input can be a bundle file or a gateway profile name if it precedes with '@' special character.");
        console.log("When gateway is specified as input, summary bundle will be pulled for comparison.");
        console.log();
        console.log("  --input <input-file-or-gateway-profile>");
        console.log("    specify two input bundles file(s) for comparison");
        console.log("    Use '@' special marker to treat the input as gateway profile name");
        console.log();
        console.log("  --output <output-file>");
        console.log("    specify the file to capture the diff report");
        console.log();
        console.log("  --options.fullDiff false|true");
        console.log("    true  : deviding resources into updates, inserts and deletes.");
        console.log("    false : default , normal diff.");
        
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
            utils.info("  selecting for insert " + butils.entityDisplayName(left));
            if (resultBundle.inserts) {
                if( !resultBundle.inserts[key]) resultBundle.inserts[key]=new Array();
                resultBundle.inserts[key].push(left);
            }
            else {
                resultEntities.push(left);
            }
        } else if (matchingEntity.checksum != null && matchingEntity.checksum !== left.checksum) { // if matchingEntity.checksum is not present, we assume user explicitely wants to ignore same entity that have different value
            utils.info("  selecting for update " + butils.entityDisplayName(left));
            if (resultBundle.updates) {
                if( !resultBundle.updates[key]) resultBundle.updates[key]=new Array();
                resultBundle.updates[key].push(left);
            }
            else {
                resultEntities.push(left);
            }
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
            if (resultBundle.deletes) {
                if( !resultBundle.deletes[key]) resultBundle.deletes[key]=new Array();
                resultBundle.deletes[key].push(right);
            }
        }
    });
}
