
const utils = require("./graphman-utils");
const graphman = require("./graphman");
const config = graphman.configuration();
const queriesDir = utils.queriesDir(config.schemaVersion);

if (config.defaultSchemaVersion !== config.schemaVersion && queriesDir === utils.queriesDir()) {
    utils.warn(`specified schema (${config.schemaVersion}) queries are missing, falling back to the default`);
}

module.exports = {
    generate: function (query, variables, options) {
        const [queryPrefix, querySuffix] = query.split(":");
        const queryFilename = utils.path(queriesDir, queryPrefix + ".json");
        const gql = utils.existsFile(queryFilename) ? utils.readFile(queryFilename) : buildGraphQLQuery(queryPrefix, querySuffix);

        gql.variables = Object.assign(gql.variables || {}, variables);
        gql.options = options || {};

        if (querySuffix === "full") {
            gql.variables.includeAllDependencies = true;
            gql.options.full = true;
        }

        if (querySuffix === "summary") {
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
        fArgs += "$" + argInfo.name + ": " + argInfo.dataType;
        sArgs += argInfo.name + ": $" + argInfo.name;
        qArgs.push(argInfo.name);
    }

    if (fArgs.length > 1) {
        fArgs += ")";
        sArgs += ")";
    } else {
        fArgs = sArgs = "";
    }

    return {
        query: `query ${queryPrefix}${fArgs} {\n` +
            `    ${queryPrefix}${sArgs} {\n` +
            `        {{${typeInfo.typeName}}}\n` +
            `    }\n` +
            `}\n`,
        args: qArgs
    };
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
            return expandGraphQLSubQuery(gql, utils.readFile(utils.path(queriesDir, subgroup)));
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
        const excludedFields = suffix && suffix.startsWith("-") ? splitTokens(suffix.substring(1)) : [];
        const includedFields = suffix && suffix.startsWith("+") ? splitTokens(suffix.substring(1)) : [];

        typeInfo.fields.forEach(fieldInfo => { // include fields
            if ((!typeInfo.excludedFields.includes(fieldInfo.name) && !excludedFields.includes(fieldInfo.name)) ||
                    includedFields.includes(fieldInfo.name)) {
                query += "\n" + fieldInfo.name;
                if (!graphman.isPrimitiveField(fieldInfo)) {
                    query += ` {\n  {{${fieldInfo.dataType}}}\n}`;
                }
            } else {
                utils.info(`excluding the query field ${typeInfo.typeName}.${fieldInfo.name}`);
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
