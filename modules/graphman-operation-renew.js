
const utils = require("./graphman-utils");
const butils = require("./graphman-bundle");
const gql = require("./graphql-query");
const exporter = require("./graphman-operation-export");
const graphman = require("./graphman");

module.exports = {
    /**
     * Renews the bundle using gateway.
     * @param params
     * @param params.input name of the input file containing the gateway configuration as bundle
     * @param params.gateway name of the gateway profile
     * @param params.output name of the output file
     * @param params.options name-value pairs used to customize renew operation
     */
    run: function (params) {
        if (!params.input) {
            throw "--input parameter is missing";
        }

        if (!params.gateway) {
            throw "--gateway parameter is missing";
        }

        const gateway = graphman.gatewayConfiguration(params.gateway);
        if (!gateway.address) {
            throw utils.newError(`${gateway.name} gateway details are missing`);
        }

        const bundle = utils.readFile(params.input);

        Promise.all(this.renew(gateway, bundle, params.options)).then(results => {
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
    },

    renew: function (gateway, bundle, options) {
        const promises = [];

        Object.keys(bundle).forEach(key => {
            const typeInfo = graphman.typeInfoByPluralName(key);
            if (typeInfo && (!options.scope.length || options.scope.includes(key))) {
                utils.info("renewing " + key);
                promises.push(renewEntities(gateway, bundle[key], typeInfo, options));
            } else {
                utils.info("ignoring " + key);
                const obj = {};
                obj[key] = bundle[key];
                promises.push(obj);
            }
        });

        return promises;
    },

    initParams: function (params, config) {
        params.options = Object.assign({scope: [], useGoids: false}, params.options);

        return params;
    },

    usage: function () {
        console.log("renew --input <input-file> --gateway <name>");
        console.log("  [--output <output-file>]");
        console.log("  [--options.<name> <value>,...]");
        console.log();
        console.log("Renews bundle using a gateway.");
        console.log("This operation is useful when the given bundle is out of date or contains partial details.");
        console.log();
        console.log("  --input <input-file>");
        console.log("    specify the name of input bundle file that contains gateway configuration");
        console.log();
        console.log("  --gateway <name>");
        console.log("    specify the name of gateway profile from the graphman configuration.");
        console.log();
        console.log("  --output <output-file>");
        console.log("    specify the name of file to capture the renewed bundle.");
        console.log("    when skipped, output will be written to the console.");
        console.log();
        console.log("  --options.<name> <value>");
        console.log("    specify options as name-value pair(s) to customize the operation");
        console.log("      .scope <enity-type-plural-name>");
        console.log("        select one or more entity types for renew operation.");
        console.log("        by default, all the entity types will be considered for operation's scope.");
        console.log("      .useGoids false|true");
        console.log("        true to use goids to renew the entities.");
        console.log("        by default, entities will be renewed using their identity details.");
        console.log();
    }
}

function renewEntities(gateway, entities, typeInfo, options) {
    if (entities.length === 0) {
        const empty = {};
        empty[typeInfo.pluralName] = [];
        return Promise.resolve(empty);
    }

    const query = gql.generateFor(entities, typeInfo, options);
    return renewInvoker(gateway, query, typeInfo);
}

function renewInvoker(gateway, query, typeInfo) {
    return new Promise(function (resolve) {
        exporter.export(gateway, query, (data, parts) => {
            const result = {};

            result[typeInfo.pluralName] = [];
            if (data.errors) {
                utils.warn("error encountered while renewing the entity", query, data.errors);
            }

            Object.keys(data.data || {}).forEach(key => {
                if (key !== 'properties') {
                    if (Array.isArray(data.data[key])) {
                        data.data[key].forEach(item => result[typeInfo.pluralName].push(item));
                    } else {
                        result[typeInfo.pluralName].push(data.data[key]);
                    }
                }
            });

            // attach parts to the intermediate bundle
            // as of now, parts will be encountered while renewing the SMF entities only
            if (parts) {
                result.parts = parts;
            }

            resolve(result);
        });
    });
}
