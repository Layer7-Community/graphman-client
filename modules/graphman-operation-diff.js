
const graphman = require("./graphman");
const utils = require("./graphman-utils");
const butils = require("./graphman-bundle");
const gql = require("./graphql-query");
const exporter = require("./graphman-operation-export");

module.exports = {
    /**
     * Identifies the differences between bundles/gateways.
     * @param params
     * @param params.input bundle or gateway profile name
     * @param params.input-report input report file name
     * @param params.output output file name
     * @param params.output-report output report file name
     * @param params.options
     * NOTE: Use "@" as prefix to differentiate the gateway profile name from the bundle name.
     */
    run: function (params) {
        const bundles = [];

        if (Array.isArray(params.input) && params.input.length >= 2) {
            bundles.push(readBundleFrom(params.input[0]));
            bundles.push(readBundleFrom(params.input[1]));

            Promise.all(bundles).then(results => {
                const leftBundle = results[0];
                const rightBundle = results[1];
                const bundle = {goidMappings: [], guidMappings: []};
                const report = {inserts: {}, updates: {}, deletes: {}, diffs: {}, mappings: {goids: [], guids: []}};

                diffReport(leftBundle, rightBundle, report, params.options || {});
                diffBundle(report, bundle, params.options || {});

                utils.writeResult(params.output, butils.sort(bundle));
                if (params["output-report"]) utils.writeResult(params["output-report"], report);
            });
        } else if (params["input-report"]) {
            const report = utils.readFile(params["input-report"]);
            const bundle = {goidMappings: [], guidMappings: []};

            diffBundle(report, bundle, params.options || {});
            utils.writeResult(params.output, butils.sort(bundle));
            if (params["output-report"]) utils.writeResult(params["output-report"], report);
        } else {
            throw utils.newError("not enough input parameters")
        }
    },

    initParams: function (params, config) {
        params.options = Object.assign({report: {}, bundle: {}}, params.options);
        return params;
    },

    usage: function () {
        console.log("diff --input <input-file-or-gateway> --input <input-file-or-gateway>");
        console.log("  [--output <output-file>]");
        console.log("  [--output-report <output-report-file>]");
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
        console.log("    specify the file to capture the diff bundle");
        console.log("  --output-report <output-report-file>");
        console.log("    specify the file to capture the diff report");
        console.log();
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
        exporter.export(
            gateway,
            gql.generate("all:summary", {}, graphman.configuration().options),
            data => resolve(data.data)
        );
    });
}

function diffReport(leftBundle, rightBundle, diffReport, options) {
    butils.forEach(leftBundle, (key, leftEntities, typeInfo) => {
        utils.info("inspecting " + key);
        diffEntities(leftEntities, rightBundle[key], diffReport, typeInfo, options);
    });

    return diffReport;
}

function diffEntities(leftEntities, rightEntities, diffReport, typeInfo, options) {
    // iterate through the left entities,
    // bucket it into diff-report, depending on the match in the right entities
    leftEntities.forEach(leftEntity => {
        const rightEntity = rightEntities.find(x => butils.isEntityMatches(leftEntity, x, typeInfo));

        if (rightEntity == null) {
            utils.info("  selecting " + butils.entityName(leftEntity, typeInfo) + ", category=inserts");
            const inserts = butils.withArray(diffReport.inserts, typeInfo);
            inserts.push(leftEntity);
        } else if (leftEntity.checksum !== rightEntity.checksum) {
            const details = [];
            if (!butils.isObjectEquals(leftEntity, rightEntity, "$", item => details.push(item))) {
                if (details.length === 1 && details[0].path === "$.checksum") {
                    utils.info("  not selecting " + butils.entityName(leftEntity, typeInfo) + ", only the checksum is different");
                } else {
                    utils.info("  selecting " + butils.entityName(leftEntity, typeInfo) + ", category=updates");
                    const updates = butils.withArray(diffReport.updates, typeInfo);
                    updates.push(leftEntity);

                    const diffs = butils.withArray(diffReport.diffs, typeInfo);
                    diffs.push({source: butils.toPartialEntity(leftEntity, typeInfo), details: details});
                }
            } else {
                utils.info("  not selecting " + butils.entityName(leftEntity, typeInfo) + ", only the checksum is different");
            }
        }
    });

    //Now, iterate through the right entities
    // find the un-matched ones w.r.t. left entities, and bucket them into diff-report
    rightEntities.forEach(rightEntity => {
        if (!leftEntities.find(x => butils.isEntityMatches(x, rightEntity, typeInfo))) {
            utils.info("  selecting " + butils.entityName(rightEntity, typeInfo) + ", category=deletes");
            const deletes = butils.withArray(diffReport.deletes, typeInfo);
            deletes.push(rightEntity);
        }
    });
}

function diffBundle(diffReport, diffBundle, options) {
    butils.forEach(diffReport.inserts, (key, entities, typeInfo) => {
        utils.info(`  adding new ${key}`);
        const array = butils.withArray(diffBundle, typeInfo);
        entities.forEach(item => {
            utils.info(`    ${butils.entityName(item, typeInfo)}`);
            array.push(item);
        });
    });

    butils.forEach(diffReport.updates, (key, entities, typeInfo) => {
        utils.info(`  adding modified ${key}`);
        const array = butils.withArray(diffBundle, typeInfo);
        entities.forEach(item => {
            utils.info(`    ${butils.entityName(item, typeInfo)}`);
            array.push(item);
        });
    });

    if (!options.excludeDeletes) butils.forEach(diffReport.deletes, (key, entities, typeInfo) => {
        utils.info(`  marking few ${key} for deletion`);
        diffBundle.properties = {mappings: {}};
        const array = butils.withArray(diffBundle.properties.mappings, typeInfo);
        entities.forEach(item => {
            utils.info(`    ${butils.entityName(item, typeInfo)}`);
            array.push(item);
        });
    });

    if (!diffBundle.goidMappings.length) delete diffBundle.goidMappings;
    if (!diffBundle.guidMappings.length) delete diffBundle.guidMappings;
}

function diffEntities1(leftEntities, rightEntities, resultEntities, resultBundle, key) {
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
            const typeInfo = graphman.typeInfoByPluralName(key);
            if (typeInfo && typeInfo.goidRefEnabled && left.goid && matchingEntity.goid !== left.goid) {
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
