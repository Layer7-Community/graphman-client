
const graphman = require("./graphman");
const utils = require("./graphman-utils");
const butils = require("./graphman-bundle");
const queryBuilder = require("./graphql-query-builder");
const opExport = require("./graphman-operation-export");
const opRenew = require("./graphman-operation-renew");

module.exports = {
    run: function (params) {
        const bundles = [];
        const config = graphman.configuration(params);

        bundles.push(readBundle(config.sourceGateway,
            Array.isArray(params.input) ? params.input[0] : params.input));
        bundles.push(readBundle(config.targetGateway,
            Array.isArray(params.input) ? params.input[1] : null));

        Promise.all(bundles).then(results => {
            const leftBundle = results[0];
            const rightBundle = results[1];
            const diffBundle = {goidMappings: [], guidMappings: []};

            diff(leftBundle, rightBundle, diffBundle);
            if (!diffBundle.goidMappings.length) delete diffBundle.goidMappings;
            if (!diffBundle.guidMappings.length) delete diffBundle.guidMappings;

            if (params.renew) {
                Promise.all(opRenew.renew(config.sourceGateway, diffBundle)).then(results => {
                    const renewedBundle = {};

                    results.forEach(item => {
                        // process parts (SMF entities) if exists
                        if (item.parts) {
                            utils.writePartsResult(utils.parentPath(params.output), item.parts);
                            delete item.parts;
                        }

                        // merge the intermediate bundles
                        Object.assign(renewedBundle, item);
                    });

                    utils.writeResult(params.output, butils.sort(renewedBundle));
                });
            } else {
                utils.writeResult(params.output, butils.sort(diffBundle));
            }
        });
    },

    usage: function () {
        console.log("    diff [--input <input-file> --input <input-file>] [--output <output-file>] [<options>]");
        console.log("        # evaluates the differences between bundles or gateways.");
        console.log("        # when input bundles are missing, bundles will be pulled from the source and target gateways.");
        console.log("        # when second input bundle is missing, it will be pulled from the target gateway.");
        console.log("      --renew");
        console.log("        # to renew the diff entities from the source gateway");
    }
}

function readBundle(gateway, file) {
    return new Promise(function (resolve) {
        if (file) {
            resolve(utils.readFile(file));
        } else {
            utils.info("retrieving the gateway configuration summary from " + gateway.address);
            opExport.export(
                gateway,
                queryBuilder.build("summary"),
                data => resolve(data.data)
            );
        }
    });
}

function diff(leftBundle, rightBundle, resultBundle) {
    Object.keys(leftBundle).forEach(key => {
        utils.info("inspecting " + key);
        resultBundle[key] = resultBundle[key]||[];
        diffEntities(leftBundle[key], rightBundle[key]||[], resultBundle[key], resultBundle, key);
        if (resultBundle[key].length === 0) {
            delete resultBundle[key];
        }
    });

    return resultBundle;
}

function diffEntities(leftEntities, rightEntities, resultEntities, resultBundle, key) {
    leftEntities.forEach(left => {
        const matchingEntity = butils.findMatchingEntity(rightEntities, left);

        if (!matchingEntity || matchingEntity.checksum !== left.checksum) {
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
