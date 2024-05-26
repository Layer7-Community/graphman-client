
const utils = require("./graphman-utils");

module.exports = {
    build: function (version, schemaVersion, refresh) {
        const metadataBaseFile = utils.schemaMetadataBaseFile(schemaVersion);
        const metadataFile = utils.schemaMetadataFile(schemaVersion);

        if (!refresh && utils.existsFile(metadataFile)) {
            return buildV2(utils.readFile(metadataFile));
        }

        const metadataBase = utils.readFile(metadataBaseFile);
        const metadata = {types: {}, subTypes: {}, primitiveTypes: metadataBase.primitiveTypes};

        metadata.types["HardwiredService"] = {category: "union", fields: []};
        buildV1(metadata, version, schemaVersion);
        utils.writeFile(metadataFile, metadata);

        return buildV2(metadata);
    }
};

function buildV2(metadata) {
    metadata.bundleTypes = {};

    Object.values(metadata.types).forEach(typeInfo => {
        if (typeInfo.isL7Entity) {
            metadata.bundleTypes[typeInfo.pluralName] = typeInfo;
        }
    });

    metadata.bundleTypes["internalSchemas"] = metadata.types["Schema"];
    metadata.bundleTypes["internalDtds"] = metadata.types["Dtd"];
    metadata.types["HardwiredService"] = Object.assign(
        {},
        metadata.types["L7Service"],
        {category: "union", isL7Entity: false}
    );

    return metadata;
}

function buildV1(metadata, version, schemaVersion) {
    metadata.version = version;
    metadata.schemaVersion = schemaVersion;

    // start parsing the graphql schema files
    const schemaDir = utils.schemaDir(schemaVersion);
    utils.listDir(schemaDir).forEach(file => {
        if (file.endsWith(".graphql")) {
            parseSchemaFile(schemaDir + "/" + file, typeInfo => {
                if (typeInfo.isL7Entity) {
                    utils.fine("  capturing type: " + typeInfo.typeName);
                    metadata.types[typeInfo.typeName] = typeInfo;
                } else if (typeInfo.category === 'enum') {
                    utils.fine("  capturing sub-type as primitive: " + typeInfo.typeName);
                    metadata.primitiveTypes.push(typeInfo.typeName);
                } else {
                    utils.fine("  capturing sub-type: " + typeInfo.typeName);

                    if (typeInfo.typeName === "Query" || typeInfo.typeName === "Mutation") {
                        const existing = metadata.subTypes[typeInfo.typeName];
                        if (existing) {
                            typeInfo.fields = existing.fields.concat(typeInfo.fields);
                        }
                    }

                    metadata.subTypes[typeInfo.typeName] = typeInfo;
                }
            });
        }
    });

    // identify the required sub-types by inspecting the main type fields
    const reqSubTypes = {};

    reqSubTypes["Query"] = metadata.subTypes["Query"];

    Object.entries(metadata.types).forEach(([key, typeInfo]) => {
        inspectTypeFields(metadata, typeInfo, (fieldInfo, subTypeInfo) => {
            if (!reqSubTypes[subTypeInfo.typeName]) {
                reqSubTypes[subTypeInfo.typeName] = subTypeInfo;
                return true;
            }

            return false;
        });
    });

    // promote the required sub-types as main types
    Object.entries(metadata.subTypes).forEach(([key, typeInfo]) => {
        if (!reqSubTypes[key]) {
            utils.fine("  ignoring sub-type: " + typeInfo.typeName);
        } else {
            utils.fine("  promoting sub-type: " + typeInfo.typeName);
            metadata.types[key] = typeInfo;
        }
    });

    // sort the fields in Query sub-type
    metadata.subTypes["Query"].fields.sort((a, b) => {
        if (a.name < b.name) return -1;
        else if (a.name > b.name) return 1;
        else return 0;
    });

    delete metadata.subTypes;

    return metadata;
}

/**
 * Parses the graphql schema files and extracts type information
 * @param file
 * @param onTypeCallback
 */
function parseSchemaFile(file, onTypeCallback) {
    const lines = utils.readFile(file).split(/\r?\n/);
    const ref = {
        tInfo: null, //type-info
        mlcInfo: {}, // multi-line comment-info
        mlc: false
    };

    for (const line of lines) {
        if (isMultiLineComment(line)) {
            ref.mlc = !ref.mlc;
            continue;
        }

        if (ref.mlc) captureMultiLineCommentInfo(line, ref);
        if (ref.mlc || isSingleLineComment(line)) continue;

        if (!ref.tInfo) {
            captureTypeInfoIfMatches(line, ref);
        } else {
            captureFieldInfoIfMatches(line, ref);

            if (line.indexOf('}') !== -1) { // type definition ends
                if (ref.tInfo) {
                    onTypeCallback(ref.tInfo);
                    ref.tInfo = null;
                    ref.mlcInfo = {};
                }
            }
        }
    }
}

function isMultiLineComment(line) {
    return line.match(/^\s*"""/);
}

function isSingleLineComment(line) {
    return line.match(/^\s*"/) || line.match(/^\s*#/);
}

function captureMultiLineCommentInfo(line, ref) {
    const match = line.match(/@([-\w]+)\s*(.*)/);
    if (match) {
        ref.mlcInfo[match[1]] = match[2];
        if (match[1] === "l7-entity") ref.mlcInfo["is-l7-entity"] = true;
    }
}

function captureTypeInfoIfMatches(line, ref) {
    const match = line.match(/(type|enum|interface)\s+(\w+)/);
    if (match) {
        ref.tInfo = {category: match[1], typeName: match[2], fields: []};
        ref.tInfo.isL7Entity = ref.mlcInfo["is-l7-entity"];

        let names = splitTokens(ref.mlcInfo["l7-entity"], "|");
        if (names.length === 0) names = camelCaseNames(match[2]);
        if (names.length > 0) ref.tInfo.singularName = names[0];
        if (names.length > 1) ref.tInfo.pluralName = names[1];

        ref.tInfo.summaryFields = splitTokens(ref.mlcInfo["l7-summary-fields"]);
        ref.tInfo.excludedFields = splitTokens(ref.mlcInfo["l7-excluded-fields"]);
        ref.tInfo.identityFields = splitTokens(ref.mlcInfo["l7-identity-fields"]);
        ref.mlcInfo = {};
    }
}

function captureFieldInfoIfMatches(line, ref) {
    const match = line.match(/\s+(\w+)\s*([(][^)]+[)])?\s*[:]\s*[\[]?(\w+)/); // field declaration, <field-name>: <field-type>
    if (match) {
        ref.tInfo.fields.push({name: match[1], dataType: match[3], args: match[2] ? extractFieldArgs(match[2]) : undefined});
    }
}

function extractFieldArgs(text) {
    const result = [];
    Array.from(text.matchAll(/\s*(\w+)\s*[:]([^,)]+)/g)).forEach(match => {
        if (match) {
            result.push({name: match[1], dataType: match[2]});
        }
    });
    return result;
}

function inspectTypeFields(metadata, typeInfo, callback) {
    for (const fieldInfo of typeInfo.fields) {
        if (!metadata.primitiveTypes.includes(fieldInfo.dataType)) {
            const subTypeInfo = metadata.subTypes[fieldInfo.dataType];
            if (subTypeInfo) {
                if (callback(fieldInfo, subTypeInfo)) {
                    inspectTypeFields(metadata, subTypeInfo, callback);
                }
            } else if (!metadata.types[fieldInfo.dataType]) {
                utils.warn(`  missing sub-type: ${fieldInfo.dataType}, ref: ${typeInfo.typeName}.${fieldInfo.name}`);
            }
        }
    }
}

function camelCaseNames(typeName) {
    const singularName = typeName.charAt(0).toLowerCase() + typeName.substring(1);
    const pluralName = singularName.endsWith("y") ? singularName.substring(0, singularName.length - 1) + "ies" : singularName + "s";
    return [singularName, pluralName];
}

function splitTokens(text, delimiter) {
    if (!text) return [];

    text = text.trim();
    return text.length === 0 ? [] : text.split(delimiter||",");
}
