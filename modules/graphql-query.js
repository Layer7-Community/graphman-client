/*
 * Copyright ©  2024. Broadcom Inc. and/or its subsidiaries. All Rights Reserved.
 */

const utils = require("./graphman-utils");
const graphman = require("./graphman");

module.exports = {
    generate: function (query, variables, options) {
        const [queryPrefix, querySuffix] = query.split(":");
        const queryFilename = utils.queryFile(queryPrefix + ".json", graphman.configuration().schemaVersion);
        const gql = utils.existsFile(queryFilename) ?
            utils.readFile(queryFilename) :
            buildGraphQLQuery(queryPrefix, querySuffix);

        gql.variables = Object.assign(gql.variables || {}, variables);
        gql.options = options || {};

        if (querySuffix === "full") {
            gql.variables.includeAllDependencies = true;
            gql.variables.includePolicyRevisions = options.includePolicyRevisions;
            gql.options.full = true;
        }

        if (querySuffix === "summary") {
            gql.variables.includePolicyRevisions = false;
            gql.options.summary = true;
        }

        const xgql = expandGraphQLQuery(gql);
        if (!options.describeQuery && xgql.args) {
            for (const qArg of xgql.args) {
                if (!xgql.variables[qArg]) utils.warn("missing variable: " + qArg);
            }
        }

        return xgql;
    },

    expand: function (query, variables, options) {
        const gql = {query: query, variables: variables || {}, options: options || {}};
        return expandGraphQLQuery(gql);
    },

    generateFor: function (entities, typeInfo, options) {
        const gql = buildGraphQLQueryFor(entities, typeInfo, options);
        gql.options = options || {};
        return expandGraphQLQuery(gql);
    }
}

/**
 * Builds simple list all query for known types
 * @param queryPrefix pluralMethod of a known type
 * @param querySuffix either summary or none.
 * @returns {{query: string}}
 */
function buildGraphQLQuery(queryPrefix, querySuffix) {
    const fieldInfo = graphman.queryFieldInfo(queryPrefix);
    const typeInfo = fieldInfo ? graphman.typeInfoByTypeName(fieldInfo.dataType) : null;

    if (!typeInfo) {
        throw "unrecognized query " + queryPrefix;
    }

    let fArgs = "(";
    let sArgs = "(";
    let qArgs = [];

    if (fieldInfo.args) for (const argInfo of fieldInfo.args) {
        fArgs += (fArgs.length > 1 ? ", $" : "$") + argInfo.name + ": " + argInfo.dataType;
        sArgs += (sArgs.length > 1 ? ", " : "") + argInfo.name + ": $" + argInfo.name;
        qArgs.push(argInfo.name);
    }

    if (fArgs.length > 1) {
        fArgs += ")";
        sArgs += ")";
    } else {
        fArgs = sArgs = "";
    }

    const suffix = querySuffix ? ":" + querySuffix : "";

    return {
        query: `query ${queryPrefix}${fArgs} {\n` +
            `    ${queryPrefix}${sArgs} {\n` +
            `        {{${typeInfo.typeName}${suffix}}}\n` +
            `    }\n` +
            `}\n`,
        args: qArgs
    };
}

/**
 * Builds query for the specified entities
 * @param entities entities to be renewed
 * @param typeInfo type-info for the entities
 * @param options
 */
function buildGraphQLQueryFor(entities, typeInfo, options) {
    const queryPrefix = typeInfo.pluralName;
    const queryArgs = [];
    const variables = {};
    let subQuery = "";

    Array.from(entities).forEach((item, index) => {
        const gql = buildGraphQLSubQueryFor(item, typeInfo, "" + (index + 1), queryArgs, options);
        subQuery += gql.query;
        Object.assign(variables, gql.variables);
    });

    const queryArgsPrefix = queryArgs.length > 0 ? "(" : "";
    const queryArgsSuffix = queryArgs.length > 0 ? ")" : "";

    return {
        query: `query ${queryPrefix}${queryArgsPrefix}${queryArgs.join(',')}${queryArgsSuffix} {\n` +
            subQuery +
            `}\n`,
        variables: variables
    };
}

function buildGraphQLSubQueryFor(entity, typeInfo, suffix, queryArgs, options) {
    let fieldMethod = typeInfo.singularName + "ByGoid";
    let fieldInfo = options.useGoids && entity.goid ? graphman.queryFieldInfo(fieldMethod) : null;

    if (!fieldInfo) {
        fieldMethod = typeInfo.singleQueryMethod || typeInfo.singularName + "By" + pascalCasing(typeInfo.identityFields[0]);
        fieldInfo = graphman.queryFieldInfo(fieldMethod);
    }

    if (!fieldInfo) {
        throw new Error("missing field information: " + fieldMethod);
    }

    const fieldArgs = [];
    const variables = {};
    if (fieldInfo.args) for (const argInfo of fieldInfo.args) {
        addQueryArg(queryArgs, argInfo.name + suffix, argInfo.dataType);
        addFieldMethodArg(fieldArgs, argInfo.name, argInfo.name + suffix);
        variables[argInfo.name + suffix] = entity[argInfo.name];
    }

    if (!options.useGoids) {
        if (typeInfo.pluralName === "soapServices" || typeInfo.pluralName === "internalSoapServices") {
            // special-case: where argument name (resolver) is different from the field name (resolvers)
            variables["resolver" + suffix] = entity["resolvers"];
        } else if (typeInfo.pluralName === "services") {
            if (entity.serviceType === "WEB_API" || entity.serviceType === "INTERNAL_WEB_API") {
                // special-case: where argument value (resolvers) is missing from the entity
                variables["resolvers" + suffix] = {
                    "resolutionPath": entity.resolutionPath
                };
            }
        }
    }

    const fieldArgsPrefix = fieldArgs.length > 0 ? "(" : "";
    const fieldArgsSuffix = fieldArgs.length > 0 ? ")" : "";

    return {
        query: `` +
            `    ${fieldInfo.name}${suffix}: ${fieldInfo.name}${fieldArgsPrefix}${fieldArgs.join(',')}${fieldArgsSuffix} {\n` +
            `        {{${typeInfo.typeName}}}\n` +
            `    }\n`,
        variables: variables
    };
}

function addQueryArg(args, name, dataType) {
    args.push(`$${name}: ${dataType}`);
}

function addFieldMethodArg(args, name, variable) {
    args.push(`${name}: $${variable}`);
}

function pascalCasing(text) {
    return text.charAt(0).toUpperCase() + text.substring(1);
}

/**
 * Expands GraphQL queries if the type references are used.
 * @param gql
 * @returns {*}
 */
function expandGraphQLQuery(gql) {
    gql.query = expandGraphQLSubQuery(gql, gql.query);
    gql.query = substituteGraphQLSubQueryFields(gql, gql.query);
    gql.query = beautifyGraphQLQuery(gql, gql.query);

    return gql;
}

function expandGraphQLSubQuery(gql, query) {
    return query.replaceAll(/{{([^}]+)}}/g, function (subtext, subgroup) {
        if (subgroup.endsWith(".gql")) {
            return expandGraphQLSubQuery(gql, utils.readFile(utils.queryFile(subgroup, graphman.configuration().schemaVersion)));
        }else {
            const [prefix, suffix] = subgroup.split(":");
            const typeInfo = graphman.typeInfoByTypeName(prefix);
            return typeInfo ? expandGraphQLSubQueryUsingTypeInfo(gql, typeInfo, suffix) : subtext;
        }
    });
}

function expandGraphQLSubQueryUsingTypeInfo(gql, typeInfo, suffix) {
    let query = "";

    if (suffix === "summary" || gql.options.summary) { // summary fields inclusion
        typeInfo.fields.forEach(fieldInfo => { // include fields
            if (typeInfo.summaryFields.length === 0 || typeInfo.summaryFields.includes(fieldInfo.name)) {
                query += "\n" + fieldInfo.name;
                if (!graphman.isPrimitiveField(fieldInfo)) {
                    query += ` {\n  {{${fieldInfo.dataType}}}\n}`;
                }
            }
        });
    } else {
        const excludedFields = [];
        const includedFields = [];

        Array.from(splitTokens(suffix)).forEach(item => {
            if (item.startsWith("-")) excludedFields.push(item.substring(1));
            else if (item.startsWith("+")) includedFields.push(item.substring(1));
            else includedFields.push(item);
        });

        if (gql.options && (!suffix || suffix.length === 0)) {
            if (gql.options.includePolicyRevisions && !includedFields.includes("policyRevisions")) {
                includedFields.push("policyRevisions");
            }
            if (gql.options.includeMultipartFields && !includedFields.includes("filePartName")) {
                includedFields.push("filePartName");
            }
        }

        typeInfo.fields.forEach(fieldInfo => { // include fields
            if ((!typeInfo.excludedFields.includes(fieldInfo.name) && !excludedFields.includes(fieldInfo.name) && !excludedFields.includes("*")) ||
                    includedFields.includes(fieldInfo.name)) {
                query += "\n" + fieldInfo.name;
                if (!graphman.isPrimitiveField(fieldInfo)) {
                    query += ` {\n  {{${fieldInfo.dataType}${fieldInfo.suffix || ""}}}\n}`;
                }
            } else {
                utils.fine(`excluding the query field ${typeInfo.typeName}.${fieldInfo.name}`);
            }
        });
    }

    return query.indexOf("{{") !== -1 ? expandGraphQLSubQuery(gql, query) : query;
}

function substituteGraphQLSubQueryFields(gql, query) {
    // substitute alternative field for policy code (xml or json or yaml or code)
    if (gql.options.policyCodeFormat && gql.options.policyCodeFormat !== "xml") {
        query = query.replaceAll(/(policy|policyRevision|policyRevisions)[^{]*[{][^}]+}/g, function (subtext) {
            return subtext.replace("xml", gql.options.policyCodeFormat);
        });
    }

    // substitute alternative field for key detail (p12 or pem)
    if (gql.options.keyFormat && gql.options.keyFormat !== "p12") {
        query = query.replaceAll(/(keys|keyBy[\w]+)[^{]*[{][^}]+}/g, function (subtext) {
            return subtext.replace("p12", gql.options.keyFormat);
        });
    }

    return query;
}

function beautifyGraphQLQuery(gql, query) {
    const result = {query: "", indentation: ""};

    query.split(/[\n]/).forEach(token => {
        const str = token.trim();
        if (str.length > 0) {
            if (str.endsWith("}")) {
                result.indentation = result.indentation.substring(0, result.indentation.length - 2);
                result.query += (result.indentation + str);
            } else if (str.endsWith("{")) {
                result.query += (result.indentation + str);
                result.indentation += "  ";
            } else {
                result.query += (result.indentation + str);
            }
            result.query += "\n";
        }
    });

    return result.query;
}

function splitTokens(text, delimiter) {
    if (!text) return [];

    text = text.trim();
    return text.length === 0 ? [] : Array.from(text.split(delimiter||",")).map(item => item.trim());
}
