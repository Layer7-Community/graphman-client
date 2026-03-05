// AI assistance has been used to generate some or all contents of this file.
// Copyright (c) 2025 Broadcom Inc. and its subsidiaries. All Rights Reserved.

const utils = require("./graphman-utils");
const graphman = require("./graphman");

const schemaCache = {};
let assertionIndex = null;
let schemaVersion = null;
let legacyValidator = null;
let useLegacyMode = false;

module.exports = {
    init: function() {
        schemaVersion = graphman.configuration().schemaVersion;

        const assertionsDir = utils.policyAssertionsDir(schemaVersion);
        if (utils.existsFile(assertionsDir)) {
            loadAssertionIndex(assertionsDir);
        } else {
            initLegacyMode();
        }
    },

    validate: function (entity, typeInfo, callback) {
        if (entity.policy) {
            if (entity.policy.json) validatePolicyCode(JSON.parse(entity.policy.json), callback);
            else if (entity.policy.code) validatePolicyCode(entity.policy.code, callback);
        }
    }
};

// Per-assertion schema mode (v11.2.1+)
function loadAssertionIndex(assertionsDir) {
    const indexFile = utils.path(assertionsDir, "_index.json");
    if (utils.existsFile(indexFile)) {
        const indexData = utils.readFile(indexFile);
        assertionIndex = indexData.assertions || {};
    } else {
        utils.warn("assertion schema index not found, validation will be limited");
        assertionIndex = {};
    }
}

// Legacy monolithic schema mode (v11.2.0 and earlier)
const LEGACY_KNOWN_ASSERTIONS = ["All", "OneOrMore", "Comment", "SetVariable", "Include", "Encapsulated", "HardcodedResponse"];

function initLegacyMode() {
    useLegacyMode = true;
    const schema = utils.readFile(utils.policySchemaFile(schemaVersion));
    legacyValidator = utils.extension("policy-code-validator").apply(schema, {});
    if (legacyValidator === schema) {
        legacyValidator = null;
    }
}

function getOrCompileValidator(assertionName) {
    if (schemaCache[assertionName]) {
        return schemaCache[assertionName];
    }

    const indexEntry = assertionIndex[assertionName];
    if (!indexEntry || !indexEntry.file) {
        return null;
    }

    const schemaFile = utils.path(utils.policyAssertionsDir(schemaVersion), indexEntry.file);
    if (!utils.existsFile(schemaFile)) {
        return null;
    }

    try {
        const schema = utils.readFile(schemaFile);
        const validator = utils.extension("policy-code-validator").apply(schema, {});
        if (typeof validator === 'function') {
            schemaCache[assertionName] = validator;
            return validator;
        }
    } catch (e) {
        utils.warn("failed to compile schema for " + assertionName + ": " + e.message);
    }

    return null;
}

function validatePolicyCode(code, callback) {
    const children = code["All"];
    if (Array.isArray(children) && isAssertionEnabled(code)) {
        validateAssertions("1", children, callback);
    } else {
        callback({path: "1", name: "All", tag: code, error: "root assertion is mis-configured"});
    }
}

function getAssertionName(assertion) {
    return Object.keys(assertion).find(x => x !==".properties");
}

function isAssertionEnabled(assertion) {
    const props = assertion[".properties"];
    return props ? props[".enabled"] || true : true;
}

function hasChildren(assertion, assertionName) {
    const value = assertion[assertionName];
    if (Array.isArray(value)) return true;
    if (value && typeof value === 'object' && Array.isArray(value['.children'])) return true;
    return false;
}

function getChildren(assertion, assertionName) {
    const value = assertion[assertionName];
    if (Array.isArray(value)) return value;
    if (value && typeof value === 'object' && Array.isArray(value['.children'])) return value['.children'];
    return [];
}

function validateAssertions(path, assertions, callback) {
    for (let i = 0; i < assertions.length; i++) {
        validateAssertion(path + "." + (i + 1), assertions[i], callback);
    }
}

function validateAssertion(path, assertion, callback) {
    const assertionName = getAssertionName(assertion);

    if (!assertionName) {
        callback({path: path, name: 'unknown', tag: assertion, category: 'error', error: 'assertion has no identifiable name'});
        return;
    }

    if (useLegacyMode) {
        validateAssertionLegacy(path, assertion, assertionName, callback);
    } else {
        validateAssertionPerSchema(path, assertion, assertionName, callback);
    }
}

function validateAssertionPerSchema(path, assertion, assertionName, callback) {
    const indexEntry = assertionIndex[assertionName];
    if (!indexEntry) {
        callback({path: path, name: assertionName, tag: assertion, category: 'info', info: 'unknown assertion, ignoring it'});
        return;
    }

    const validator = getOrCompileValidator(assertionName);
    if (!validator) {
        callback({path: path, name: assertionName, tag: assertion, category: 'info', info: 'no schema available, skipping validation'});
        return;
    }

    const valid = validator(assertion);
    if (!valid) {
        callback({path: path, name: assertionName, tag: assertion, category: 'error', error: 'validation failed', errors: validator.errors});
    } else if (hasChildren(assertion, assertionName)) {
        validateAssertions(path, getChildren(assertion, assertionName), callback);
    }
}

function validateAssertionLegacy(path, assertion, assertionName, callback) {
    if (!LEGACY_KNOWN_ASSERTIONS.includes(assertionName)) {
        callback({path: path, name: assertionName, tag: assertion, category: 'info', info: 'unknown assertion, ignoring it'});
    } else if (legacyValidator) {
        const valid = legacyValidator(assertion);
        if (!valid) {
            callback({path: path, name: assertionName, tag: assertion, category: 'error', error: 'validation failed', errors: legacyValidator.errors});
        } else if (hasChildren(assertion, assertionName)) {
            validateAssertions(path, getChildren(assertion, assertionName), callback);
        }
    }
}
