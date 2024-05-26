
const utils = require("./graphman-utils");
const butils = require("./graphman-bundle");
const queryBuilder = require("./graphql-query-builder");
const exporter = require("./graphman-operation-export");
const graphman = require("./graphman");
const metadata = graphman.schemaMetadata();

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
            if (metadata.pluralMethods[key] && (!options.scope.length || options.scope.includes(key))) {
                utils.info("renewing " + key);
                promises.push(renewEntities(gateway, bundle[key], metadata.pluralMethods[key]));
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
        params.options = Object.assign({scope: []}, params.options);

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
        console.log();
    }
}

function renewEntities(gateway, entities, type) {
    const typeObj = metadata.types[type];

    if (entities.length === 0) {
        const empty = {};
        empty[typeObj.pluralMethod] = [];
        return Promise.resolve(empty);
    }

    let queryInfo = {head: `query reviseBundleFor${type}(\n`, body: "", variables: {}};

    if (type === 'SoapService') {
        buildQueryForSoapServiceEntities(entities, type, typeObj, queryInfo);
    } else if (type === 'FipUser' || type === 'FipGroup') {
        buildQueryForFipUserOrGroupEntities(entities, type, typeObj, queryInfo);
    } else if (type === 'InternalIdp') {
        queryInfo.head = `query reviseBundleFor${type}\n`;
        queryInfo.body += `    internalIdps { {{InternalIdp}} }\n`;
    } else {
        buildQueryForEntities(entities, type, typeObj, queryInfo);
    }

    const gql = {
        query: `${queryInfo.head} {\n ${queryInfo.body} }\n`,
        variables: queryInfo.variables,
        options: {}
    };

    gql.query = queryBuilder.expandQuery(gql.query, graphman.configuration().options);
    gql.query = gql.query.replaceAll("hardwiredService{ {{HardwiredService}} }", "");
    return renewInvoker(gateway, gql, typeObj);
}

function buildQueryForSoapServiceEntities(entities, type, typeObj, queryInfo) {
    let separator = "";
    entities.forEach((entity, index) => {
        const refName = `${typeObj.singularMethod}${index + 1}`;
        queryInfo.head += separator + `  $${refName}: SoapServiceResolverInput!`;
        queryInfo.body += `    ${refName}:  ${typeObj.singularMethod} (resolver: $${refName}){ {{${type}}} }\n`;
        separator = ",\n";
        const idFieldValue = queryInfo.variables[refName] = Object.assign({}, entity[typeObj.idField]);
        if (idFieldValue.soapActions) {
            idFieldValue.soapAction = idFieldValue.soapActions[0];
            delete idFieldValue.soapActions;
        }
        utils.info(`  using ${typeObj.idField}=${idFieldValue.resolutionPath},${idFieldValue.baseUri},${idFieldValue.soapAction}`);
    });
    queryInfo.head += ')';
}

function buildQueryForFipUserOrGroupEntities(entities, type, typeObj, queryInfo) {
    let separator = "";
    entities.forEach((entity, index) => {
        const nameField = type === 'FipGroup' ? "groupName" : "userName";
        const refName = `${typeObj.singularMethod}${index + 1}`;
        queryInfo.head += separator + `  $${refName}ProviderName: String!`;
        queryInfo.head += separator + `  $${refName}Name: String!`;
        queryInfo.body += `    ${refName}:  ${typeObj.singularMethod} (providerName: $${refName}ProviderName, ${nameField}: $${refName}Name){ {{${type}}} }\n`;
        separator = ",\n";
        queryInfo.variables[refName + "ProviderName"] = entity.providerName;
        queryInfo.variables[refName + "Name"] = entity.name;
        utils.info(`  using providerName=${entity.providerName},name=${entity.name}`);
    });
    queryInfo.head += ')';
}

function buildQueryForEntities(entities, type, typeObj, queryInfo) {
    let separator = "";
    let excludedFields = metadata.parserHints.excludedFields[type];
    excludedFields = excludedFields ? ":-" + excludedFields : "";
    entities.forEach((entity, index) => {
        const refName = `${typeObj.singularMethod}${index + 1}`;
        queryInfo.head += separator + `  $${refName}: String!`;
        queryInfo.body += `    ${refName}:  ${typeObj.singularMethod} (${typeObj.idField}: $${refName}){ {{${type}${excludedFields}}} }\n`;
        separator = ",\n";
        const idFieldValue = queryInfo.variables[refName] = entity[typeObj.idField];
        utils.info(`  using ${typeObj.idField}=${idFieldValue}`);
    });
    queryInfo.head += ')';
}

function renewInvoker(gateway, query, typeObj) {
    return new Promise(function (resolve) {
        exporter.export(gateway, query, (data, parts) => {
            const result = {};

            result[typeObj.pluralMethod] = [];
            if (data.errors) {
                utils.warn("error encountered while renewing the entity", query, data.errors);
            }

            Object.keys(data.data || {}).forEach(key => {
                if (key !== 'properties') {
                    if (Array.isArray(data.data[key])) {
                        data.data[key].forEach(item => result[typeObj.pluralMethod].push(item));
                    } else {
                        result[typeObj.pluralMethod].push(data.data[key]);
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
