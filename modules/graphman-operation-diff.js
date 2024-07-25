/*
 * Copyright ©  2024. Broadcom Inc. and/or its subsidiaries. All Rights Reserved.
 */

const graphman = require("./graphman");
const utils = require("./graphman-utils");
const butils = require("./graphman-bundle");
const gql = require("./graphql-query");
const exporter = require("./graphman-operation-export");

module.exports = {
    /**
     * Identifies the differences between bundles/gateways.
     * @param params
     * @param params.input-source source bundle or source gateway profile name
     * @param params.input-target target bundle or tagert gateway profile name
     * @param params.input-report input report file name
     * @param params.output output file name
     * @param params.output-report output report file name
     * @param params.options
     * @param params.options.includeInserts flag to decide including entities from the includes section
     * @param params.options.includeUpdates flag to decide including entities from the updates section
     * @param params.options.includeDeletes flag to decide including entities from the deletes section
     * NOTE: Use "@" as prefix to differentiate the gateway profile name from the bundle name.
     */
    run: function (params) {
        const bundles = [];

        if (params["input-source"] && params["input-target"]) {
            bundles.push(readBundleFrom(params["input-source"]));
            bundles.push(readBundleFrom(params["input-target"]));

            Promise.all(bundles).then(results => {
                const leftBundle = results[0];
                const rightBundle = results[1];
                const bundle = {};
                const report = {inserts: {}, updates: {}, deletes: {}, diffs: {}, mappings: {goids: [], guids: []}};

                diffReport(leftBundle, rightBundle, report, params.options);
                diffBundle(report, bundle, params.options, false);

                utils.writeResult(params.output, butils.sort(bundle));
                if (params["output-report"]) utils.writeResult(params["output-report"], report);
            });
        } else if (params["input-report"]) {
            const report = utils.readFile(params["input-report"]);
            const bundle = {};

            diffBundle(report, bundle, params.options, true);
            utils.writeResult(params.output, butils.sort(bundle));
            if (params["output-report"]) utils.writeResult(params["output-report"], report);
        } else {
            throw utils.newError("not enough input parameters")
        }
    },

    initParams: function (params, config) {
        params.options = Object.assign({includeInserts: true, includeUpdates: true, includeDeletes: false}, params.options);
        return params;
    },

    usage: function () {
        console.log("diff --input-source <input-file-or-gateway> --input-target <input-file-or-gateway>");
        console.log("  [--input-report <input-report-file>]");
        console.log("  [--output <output-file>]");
        console.log("  [--output-report <output-report-file>]");
        console.log("  [--options.<name> <value>,...]");
        console.log();
        console.log("Evaluates the differences between bundles or gateways.");
        console.log("Input can be a bundle file or a gateway profile name if it precedes with '@' special character.");
        console.log("When gateway is specified as input, summary bundle will be pulled for comparison.");
        console.log("Differences are computed such that what can be done to the target to match with the given source.");
        console.log();
        console.log("  --input-source <input-file-or-gateway-profile>");
        console.log("    specify source input bundle file for comparison");
        console.log("    Use '@' special marker to treat the input as gateway profile name");
        console.log();
        console.log("  --input-target <input-file-or-gateway-profile>");
        console.log("    specify target input bundle file for comparison");
        console.log("    Use '@' special marker to treat the input as gateway profile name");
        console.log();
        console.log("  --input-report <input-report-file>");
        console.log("    specify the input diff report file to generate the diff bundle");
        console.log("    NOTE: this parameter will be ignored if the input parameter is specified");
        console.log();
        console.log("  --output <output-file>");
        console.log("    specify the file to capture the diff bundle");
        console.log();
        console.log("  --output-report <output-report-file>");
        console.log("    specify the file to capture the diff report");
        console.log();
        console.log("  --options.<name> <value>");
        console.log("    specify options as name-value pair(s) to customize the operation");
        console.log("      .includeInserts true|false");
        console.log("        decides whether to include entities from the inserts section.");
        console.log("      .includeUpdates true|false");
        console.log("        decides whether to include entities from the update section.");
        console.log("      .includeDeletes false|true");
        console.log("        decides whether to include entities from the deletes section.");
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

function diffReport(leftBundle, rightBundle, report, options) {
    const multiLineTextDiffExtension = utils.extension("multiline-text-diff");

    butils.forEach(leftBundle, (key, leftEntities, typeInfo) => {
        utils.info("inspecting " + key);
        diffEntities(leftEntities, rightBundle[key], report, typeInfo, options, multiLineTextDiffExtension);
    });

    butils.forEach(rightBundle, (key, rightEntities, typeInfo) => {
        const leftEntities = leftBundle[key];
        if (!leftEntities || leftEntities.length === 0) {
            utils.info("inspecting " + key);
            rightEntities.forEach(rightEntity => {
                utils.info("  selecting " + butils.entityName(rightEntity, typeInfo) + ", category=deletes");
                const deletes = butils.withArray(report.deletes, typeInfo);
                deletes.push(rightEntity);
            });
        }
    });

    return report;
}

/**
 * To identify the differences among class-of entities
 * @param leftEntities entities from left bundle
 * @param rightEntities entities from right bundle
 * @param report diff report
 * @param typeInfo type-info about class
 * @param options
 * @param multiLineTextDiffExtension multiline text deff extension
 */
function diffEntities(leftEntities, rightEntities, report, typeInfo, options, multiLineTextDiffExtension) {
    // iterate through the left entities,
    // bucket it into diff-report, depending on the match in the right entities
    leftEntities.forEach(leftEntity => {
        const rightEntity = rightEntities ? rightEntities.find(x => butils.isEntityMatches(leftEntity, x, typeInfo)) : null;
        if (rightEntity == null) {
            utils.info("  selecting " + butils.entityName(leftEntity, typeInfo) + ", category=inserts");
            const inserts = butils.withArray(report.inserts, typeInfo);
            inserts.push(leftEntity);
        } else if (leftEntity.checksum !== rightEntity.checksum) {
            const details = [];
            const codeRef = makeEntityReadyForEqualityCheck(leftEntity, rightEntity);

            // compare objects
            const equals = butils.isObjectEquals(leftEntity, rightEntity, "$", item => {
                details.push(multiLineTextDiffExtension.apply({
                    path: item.path,
                    source: item.left,
                    target: item.right
                }, typeInfo.pluralName, options));
            });

            // restore policy code
            if (codeRef.left) leftEntity.policy.code = codeRef.left;
            if (codeRef.right) rightEntity.policy.code = codeRef.right;

            if (!equals) {
                if (details.length === 1 && details[0].path === "$.checksum") {
                    utils.info("  not selecting " + butils.entityName(leftEntity, typeInfo) + ", only the checksum is different");
                } else {
                    utils.info("  selecting " + butils.entityName(leftEntity, typeInfo) + ", category=updates");
                    const updates = butils.withArray(report.updates, typeInfo);
                    updates.push(leftEntity);

                    const diffs = butils.withArray(report.diffs, typeInfo);
                    diffs.push({source: butils.toPartialEntity(leftEntity, typeInfo), details: details});
                }
            } else {
                utils.info("  not selecting " + butils.entityName(leftEntity, typeInfo) + ", only the checksum is different");
            }
        }

        if (rightEntity != null && typeInfo.goidRefEnabled) {
            if (leftEntity.goid && rightEntity.goid !== leftEntity.goid) {
                utils.info(`  selecting ` + butils.entityName(leftEntity, typeInfo) + `, category=goid-mappings`);
                report.mappings.goids.push({left: leftEntity.goid, right: rightEntity.goid});
            }

            if (leftEntity.guid && rightEntity.guid !== leftEntity.guid) {
                utils.info(`  selecting ` + butils.entityName(leftEntity, typeInfo) + `, category=guid-mappings`);
                report.mappings.guids.push({left: leftEntity.guid, right: rightEntity.guid});
            }
        }
    });

    //Now, iterate through the right entities
    // find the un-matched ones w.r.t. left entities, and bucket them into diff-report
    if (rightEntities) rightEntities.forEach(rightEntity => {
        if (!leftEntities.find(x => butils.isEntityMatches(x, rightEntity, typeInfo))) {
            utils.info("  selecting " + butils.entityName(rightEntity, typeInfo) + ", category=deletes");
            const deletes = butils.withArray(report.deletes, typeInfo);
            deletes.push(rightEntity);
        }
    });
}

/**
 * Makes the entities comparison friendly.
 * If entity possesses policy code, it will be re-written as string.
 * @param leftEntity
 * @param rightEntity
 * @returns code-ref object
 */
function makeEntityReadyForEqualityCheck(leftEntity, rightEntity) {
    const codeRef = {left: null, right: null};

    // capture policy code and re-write it as string for comparison friendly
    if (leftEntity.policy) {
        codeRef.left = leftEntity.policy.code;
        leftEntity.policy.code = JSON.stringify(codeRef.left, null, 0);
    }

    if (rightEntity.policy) {
        codeRef.right = rightEntity.policy.code;
        rightEntity.policy.code = JSON.stringify(codeRef.right, null, 0);
    }

    return codeRef;
}

function diffBundle(report, bundle, options, verbose) {
    if (options.includeInserts) butils.forEach(report.inserts, (key, entities, typeInfo) => {
        if (verbose) utils.info(`adding ${key}, category=inserts`);
        const array = butils.withArray(bundle, typeInfo);
        entities.forEach(item => {
            if (verbose) utils.info(`  ${butils.entityName(item, typeInfo)}`);
            array.push(item);
        });
    });

    if (options.includeUpdates) butils.forEach(report.updates, (key, entities, typeInfo) => {
        if (verbose) utils.info(`adding ${key}, category=updates`);
        const array = butils.withArray(bundle, typeInfo);
        entities.forEach(item => {
            if (verbose) utils.info(`  ${butils.entityName(item, typeInfo)}`);
            array.push(item);
        });
    });

    if (options.includeDeletes) butils.forEach(report.deletes, (key, entities, typeInfo) => {
        if (verbose) utils.info(`adding ${key}, category=deletes`);
        bundle.properties = {mappings: {}};
        const array = butils.withArray(bundle.properties.mappings, typeInfo);
        entities.forEach(item => {
            if (verbose) utils.info(`  ${butils.entityName(item, typeInfo)}`);
            array.push(butils.mappingInstruction('DELETE', item, typeInfo));
        });
    });

    butils.forEach(bundle, (key, entities, typeInfo) => {
        if (report.mappings.goids.length) reviseEntities(entities, typeInfo, report.mappings.goids);
        if (report.mappings.guids.length) reviseEntities(entities, typeInfo, report.mappings.guids);
    });
}

function reviseEntities(entities, typeInfo, mappings) {
    entities.forEach(entity => {
        if (entity.policy) {
            reviseEntity(entity, typeInfo, mappings);
        }
    });
}

function reviseEntity(entity, typeInfo, mappings) {
    const name = butils.entityName(entity, typeInfo);
    mappings.forEach(mapping => {
        if (entity.policy.xml) entity.policy.xml = entity.policy.xml.replaceAll(mapping.left, function (match) {
            utils.info(`  revising ${name}, replacing ${mapping.left} with ${mapping.right}`);
            return mapping.right;
        });

        if (entity.policy.json) entity.policy.json = entity.policy.json.replaceAll(mapping.left, function (match) {
            utils.info(`  revising ${name}, replacing ${mapping.left} with ${mapping.right}`);
            return mapping.right;
        });

        if (entity.policy.yaml) entity.policy.yaml = entity.policy.yaml.replaceAll(mapping.left, function (match) {
            utils.info(`  revising ${name}, replacing ${mapping.left} with ${mapping.right}`);
            return mapping.right;
        });
    });
}
