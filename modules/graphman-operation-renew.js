
const utils = require("./graphman-utils");
const butils = require("./graphman-bundle");
const queryBuilder = require("./graphql-query-builder");
const opExport = require("./graphman-operation-export");
const graphman = require("./graphman");
const SCHEMA_METADATA = graphman.schemaMetadata();

module.exports = {
    run: function (params) {
        if (!params.input) {
            throw "--input parameter is missing";
        }

        const bundle = utils.readFile(params.input);

        Promise.all(this.renew(graphman.configuration(params).sourceGateway, bundle, params.scope)).then(results => {
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

    renew: function (gateway, bundle, scope) {
        const promises = [];
        scope = scope || [];

        Object.keys(bundle).forEach(key => {
            if (SCHEMA_METADATA.pluralMethods[key] && (!scope.length || scope.includes(key))) {
                utils.info("renewing " + key);
                promises.push(renewEntities(gateway, bundle[key], SCHEMA_METADATA.pluralMethods[key]));
            } else {
                utils.info("ignoring " + key);
                const obj = {};
                obj[key] = bundle[key];
                promises.push(obj);
            }
        });

        return promises;
    },

    usage: function () {
        console.log("    renew --input <input-file> [--output <output-file>] [<options>]");
        console.log("      --scope <entity-type-plural-tag>");
        console.log("        # to select one or more entity types for renew operation.");
        console.log("        # repeat this option to select multiple entity types.");
    }
}

function renewEntities(gateway, entities, type) {
    if (entities.length === 0) {
        const empty = {};
        empty[type.pluralMethod] = [];
        return Promise.resolve(empty);
    }

    const typeObj = SCHEMA_METADATA.types[type];
    let queryInfo = {head: `query reviseBundleFor${type}(\n`, body: "", variables: {}};

    if (type === 'SoapService') {
        buildQueryForSoapServiceEntities(entities, type, typeObj, queryInfo);
    } else if (type === 'FipUser' || type === 'FipGroup') {
        buildQueryForFipUserOrGroupEntities(entities, type, typeObj, queryInfo);
    } else {
        buildQueryForEntities(entities, type, typeObj, queryInfo);
    }

    const gql = {
        query: `${queryInfo.head} ){\n ${queryInfo.body} }\n`,
        variables: queryInfo.variables
    };

    gql.query = queryBuilder.expandQuery(gql.query);
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
}

function buildQueryForEntities(entities, type, typeObj, queryInfo) {
    let separator = "";
    entities.forEach((entity, index) => {
        const refName = `${typeObj.singularMethod}${index + 1}`;
        queryInfo.head += separator + `  $${refName}: String!`;
        queryInfo.body += `    ${refName}:  ${typeObj.singularMethod} (${typeObj.idField}: $${refName}){ {{${type}}} }\n`;
        separator = ",\n";
        const idFieldValue = queryInfo.variables[refName] = entity[typeObj.idField];
        utils.info(`  using ${typeObj.idField}=${idFieldValue}`);
    });
}

function renewInvoker(gateway, query, typeObj) {
    return new Promise(function (resolve) {
        opExport.export(gateway, query, (data, parts) => {
            const result = {};

            result[typeObj.pluralMethod] = [];
            Object.keys(data.data).forEach(key => {
                result[typeObj.pluralMethod].push(data.data[key]);
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
