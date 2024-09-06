/*
 * Copyright ©  2024. Broadcom Inc. and/or its subsidiaries. All Rights Reserved.
 */

const graphman = require("./graphman");
const utils = require("./graphman-utils");
const butils = require("./graphman-bundle");
const gql = require("./graphql-query");
const exporter = require("./graphman-operation-export");
const renewer = require("./graphman-operation-renew");

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
     * @param params.options.renewEntities flag to decide renewing the entities from the respective gateways
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
                const report = {inserts: {}, updates: {}, deletes: {}, diffs: {}, mappings: {goids: [], guids: []}};

                diffReport(leftBundle, rightBundle, report, params.options);
                if (params.options.renewEntities) {
                    diffRenewReport(leftBundle, rightBundle, report, params.options, renewedReport => {
                        const bundle = {};
                        diffBundle(renewedReport, bundle, params.options, false);

                        if (params["output-report"]) {
                            utils.writeResult(params["output-report"], sortReport(renewedReport));
                        }

                        utils.writeResult(params.output, butils.sort(bundle));
                    });
                } else {
                    const bundle = {};
                    diffBundle(report, bundle, params.options, false);

                    if (params["output-report"]) {
                        utils.writeResult(params["output-report"], sortReport(report));
                    }

                    utils.writeResult(params.output, butils.sort(bundle));
                }
            }).catch(error => {
                utils.error("errors encountered while analyzing the differences", error);
                utils.print();
            });
        } else if (params["input-report"]) {
            const report = utils.readFile(params["input-report"]);
            const bundle = {};

            diffBundle(report, bundle, params.options, true);
            utils.writeResult(params.output, butils.sort(bundle));
        } else {
            throw utils.newError("not enough input parameters");
        }
    },

    initParams: function (params, config) {
        params.options = Object.assign({includeInserts: true, includeUpdates: true, includeDeletes: false}, params.options);
        return params;
    },

    usage: function () {
        console.log("diff --input-source <input-file-or-gateway> --input-target <input-file-or-gateway>");
        console.log("  [--output <output-file>]");
        console.log("  [--output-report <output-report-file>]");
        console.log("  [--options.<name> <value>,...]");
        console.log();
        console.log("diff --input-report <input-report-file>");
        console.log("  [--output <output-file>]");
        console.log("  [--options.<name> <value>,...]");
        console.log();
        console.log("Evaluates the differences between bundles or gateways.");
        console.log("Input can be a bundle file or a gateway profile name if it precedes with '@' special character.");
        console.log("When gateway is specified as input, summary bundle will be pulled for comparison.");
        console.log("Differences are computed such that what can be done to the target to match with the given source.");
        console.log("The difference bundle and it's comprehensive report will be generated.");
        console.log("The difference report can be used to re-generate the difference bundle when required.");
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
        console.log("    NOTE: this parameter will be ignored if the source and target input parameters are specified");
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
        console.log("      .renewEntities false|true");
        console.log("        decides whether to renew entities from the respective gateways when specified.");
        console.log();
    }
}

function readBundleFrom(fileOrGateway) {
    if (fileOrGateway.startsWith('@')) {
        const gateway = graphman.gatewayConfiguration(fileOrGateway.substring(1));
        if (!gateway.address) throw utils.newError(`${gateway.name} gateway details are missing`);
        return readBundleFromGateway(gateway);
    } else {
        return Promise.resolve(utils.readFile(fileOrGateway));
    }
}

function readBundleFromGateway(gateway) {
    return new Promise(function (resolve, reject) {
        utils.info(`retrieving ${gateway.name} gateway configuration summary`);
        try {
            exporter.export(
                gateway,
                gql.generate("all:summary", {}, graphman.configuration().options),
                data => {
                    if (data.errors) {
                        utils.warn(`errors detected while retrieving ${gateway.name} gateway configuration summary`);
                        reject(data.errors);
                    }

                    const bundle = data.data || {};
                    bundle.properties = bundle.properties || {};
                    bundle.properties.meta = bundle.properties.meta || {};
                    bundle.properties.meta.summary = true;
                    bundle.properties.meta.gateway = gateway.name;
                    resolve(bundle);
                }
            );
        } catch (error) {
            reject(error);
        }
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

function sortReport(report) {
    report.inserts = butils.sort(report.inserts);
    report.updates = butils.sort(report.updates);
    report.deletes = butils.sort(report.deletes);
    return report;
}

function diffRenewReport(leftBundle, rightBundle, report, options, callback) {
    let promises = [];

    if (leftBundle.properties.meta.summary) {
        const gateway = graphman.gatewayConfiguration(leftBundle.properties.meta.gateway);

        // renew inserts section using the source gateway
        promises.push(new Promise(function (resolve, reject) {
            renewBundle(gateway, report.inserts, ["*"], Object.assign(options, {useGoids: true}), resolve, reject);
        }));

        // renew updates section using the source gateway
        promises.push(new Promise(function (resolve, reject) {
            renewBundle(gateway, report.updates, ["*"], Object.assign(options, {useGoids: true}), resolve, reject);
        }));
    } else {
        promises.push(new Promise(function (resolve) {
            resolve(report.inserts);
        }));

        promises.push(new Promise(function (resolve) {
            resolve(report.updates);
        }));
    }

    if (rightBundle.properties.meta.summary) {
        const gateway = graphman.gatewayConfiguration(rightBundle.properties.meta.gateway);

        // renew updates section using the target gateway
        promises.push(new Promise(function (resolve, reject) {
            renewBundle(gateway, report.updates, ["*"], Object.assign(options, {useGoids: false}), resolve, reject);
        }));
    }

    // generate report using the renewed details
    Promise.all(promises).then(results => {
        if (results.length <= 2) {
            const renewedReport = {inserts: results[0], updates: results[1], deletes: report.deletes, diffs: report.diffs, mappings: report.mappings};
            callback(renewedReport);
        } else {
            const renewedReport = {inserts: {}, updates: {}, deletes: {}, diffs: {}, mappings: {goids: [], guids: []}};
            const multiLineTextDiffExtension = utils.extension("multiline-text-diff");
            const leftUpdateBundle = results[1];
            const rightUpdateBundle = results[2];

            butils.forEach(leftUpdateBundle, (key, leftEntities, typeInfo) => {
                utils.info("re-inspecting " + key);
                diffEntities(leftEntities, rightUpdateBundle[key], renewedReport, typeInfo, options, multiLineTextDiffExtension);
            });

            callback(renewedReport);
        }
    }).catch(error => {
        utils.error("errors encountered while renewing the entities", error);
        utils.print();
    });
}

function renewBundle(gateway, bundle, sections, options, resolve, reject) {
    if (!gateway.address) {
        reject(utils.newError(`${gateway.name} gateway details are missing`));
    }

    Promise.all(renewer.renew(gateway, bundle, sections, options)).then(results => {
        const renewedBundle = {};
        results.forEach(item => Object.assign(renewedBundle, item));
        resolve(butils.sort(renewedBundle));
    }).catch(error => reject(error));
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
        } else if (rightEntity.checksum === undefined) {
            utils.info("  ignoring " + butils.entityName(leftEntity, typeInfo) + ", target entity checksum is undefined");
        } else if (leftEntity.checksum === undefined || leftEntity.checksum !== rightEntity.checksum) {
            const details = [];
            const codeRef = makeEntityReadyForEqualityCheck(leftEntity, rightEntity);

            // compare objects
            const equals = butils.isObjectEquals(leftEntity, rightEntity, "$", item => {
                details.push(multiLineTextDiffExtension.apply({
                    path: item.path,
                    source: item.left,
                    target: item.right
                }, {typeInfo: {pluralName: typeInfo.pluralName}, options: options}));
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
                    const record = butils.toPartialEntity(leftEntity, typeInfo);
                    record.details = details;
                    diffs.push(record);
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
    if (leftEntity.policy  && leftEntity.policy.code) {
        codeRef.left = leftEntity.policy.code;
        leftEntity.policy.code = JSON.stringify(codeRef.left, null, 0);
    }

    if (rightEntity.policy && rightEntity.policy.code) {
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
