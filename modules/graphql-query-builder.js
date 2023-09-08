/*
GraphQL query is composed out of two files from the <home>/queries directory.
<sample>.json
<sample>.gql
<sample-full>.gql --> this will be used if --includeDependencies flag is specified.
Note that, <sample>.gql requires pre-processing if type references are used.

Type references are defined as follows:
<type-reference>:- {{<type>[:<suffix>]}}
<suffix>:- summary|-[<field>[,<field>]*]
<type>:- type identifier
<field>:- field identifier

Here, <type-reference>, a defined GraphQL type, will be expanded to its fields in a query. This expansion can be controlled via <suffix>.
If <suffix> is 'summary', type reference will be expanded to the summary fields.
If <suffix> is starting with hyphen and comma separated list of fields, type reference will be expanded to the fields except this list.
If <suffix> is not used, type reference will be expanded to the fields.

NOTE: type reference can refer other type references. But, ensure it doesn't end up recursive infinite loop.
 */
const utils = require("./graphman-utils");
const graphman = require("./graphman");
const CONFIG = graphman.configuration();
const SCHEMA_METADATA = graphman.schemaMetadata();
const QUERIES_DIR = utils.queriesDir(CONFIG.schemaVersion);

if (CONFIG.defaultSchemaVersion !== CONFIG.schemaVersion && QUERIES_DIR === utils.queriesDir()) {
    utils.warn(`specified schema (${CONFIG.schemaVersion}) queries are missing, falling back to the default`);
}

module.exports = {
    build: function (queryId, variables) {
        const [queryIdPrefix, queryIdSuffix] = queryId.split(":");
        const queryFilename = `${QUERIES_DIR}/${queryIdPrefix}.json`;
        const gql = utils.existsFile(queryFilename) ? utils.readFile(queryFilename) : buildQuery(queryIdPrefix, queryIdSuffix);

        // look for specific version of query if exists
        if (queryIdSuffix) {
            if (gql.query === `{{${queryIdPrefix}.gql}}` &&
                utils.existsFile(`${QUERIES_DIR}/${queryIdPrefix}-${queryIdSuffix}.gql`)) {
                gql.query = `{{${queryIdPrefix}-${queryIdSuffix}.gql}}`;
            } else if (queryIdSuffix === "full") {
                variables.includeAllDependencies = true;
            } else if (queryIdSuffix === "partial") {
                variables.includeDirectDependencies = true;
            } else if (queryIdSuffix === "summary") {
                variables.summary = true;
            } else {
                utils.info("ignoring the suffix: " + queryIdSuffix);
            }
        }

        gql.query = gql.query.replaceAll(/{{([^}]+)}}/g, function (subtext, file) {
            return file.endsWith(".gql") ? utils.readFile(`${QUERIES_DIR}/${file}`) : subtext;
        });
        gql.query = expandQuery(gql.query);
        gql.variables = Object.assign(gql.variables || {}, variables);

        return gql;
    },

    expandQuery: function (query) {
        return expandQuery(query);
    }
}

/**
 * Expands GraphQL queries if the type references are used.
 * @param text GraphQL query
 * @returns {string} expanded GraphQL query
 */
function expandQuery(text) {
    return text.replaceAll(/{{([^}]+)}}/g, function (subtext, subgroup) {
        const tokens = (subgroup + ":").split(":");
        const typeName = tokens[0];
        const suffix = tokens[1];
        const typeDef = SCHEMA_METADATA.types[typeName];
        return typeDef ? expandQueryForType(typeDef, suffix) : subtext;
    });
}

function expandQueryForType(typeDef, suffix) {
    const indentation = " ";
    var result = "";

    if (suffix === "summary") { // summary fields inclusion
        typeDef.summaryFields.forEach(item => result += indentation + item);
    } else {
        excludeFields = suffix && suffix.startsWith("-") ? suffix.substring(1).split(",") : []; // exclude fields if specified
        typeDef.fields.forEach(item => { // include fields
            if (!excludeFields.includes(item.split("{")[0].trim())) {
                result += indentation + item;
            }
        });
    }

    return result.indexOf("{{") !== -1 ? expandQuery(result) : result;
}

/**
 * Builds simple list all query for known types
 * @param queryIdPrefix pluralMethod of a known type
 * @param queryIdSuffix either summary or none.
 * @returns {{query: string}}
 */
function buildQuery(queryIdPrefix, queryIdSuffix) {
    const type = SCHEMA_METADATA.pluralMethods[queryIdPrefix];
    if (type) {
        const excludedSuffix = SCHEMA_METADATA.parserHints.excludedFields[type];
        const typeRef = queryIdSuffix === "summary" ? type + ":summary" : type + (excludedSuffix ? ":-" + excludedSuffix : "");

        return {
            query: `query ${queryIdPrefix} {\n  ${queryIdPrefix} {\n {{${typeRef}}}\n  }\n}`
        };
    } else {
        throw "unrecognized query " + queryIdPrefix;
    }
}
