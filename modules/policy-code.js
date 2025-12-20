// Copyright (c) 2025 Broadcom Inc. and its subsidiaries. All Rights Reserved.

const utils = require("./graphman-utils");
const graphman = require("./graphman");
const vRef = {validator: null, schema: null};
const knownAssertions = ["All", "OneOrMore", "Comment", "SetVariable", "Include", "Encapsulated", "HardcodedResponse"];

module.exports = {
    init: function() {
        if (!vRef.validator && !vRef.schema) {
            if (!vRef.schema) {
                vRef.schema = utils.readFile(utils.policySchemaFile(graphman.configuration().schemaVersion));
            }

            vRef.validator = utils.extension("policy-code-validator").apply(vRef.schema, {});
            if (vRef.validator === vRef.schema) {
                vRef.validator = null;
            }
        }
    },

    validate: function (entity, typeInfo, callback) {
        if (entity.policy && vRef.validator) {
            if (entity.policy.json) validatePolicyCode(JSON.parse(entity.policy.json), callback);
            else if (entity.policy.code) validatePolicyCode(entity.policy.code, callback);
        }
    }
};

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

function isCompositeAssertion(assertion, assertionName) {
    return Array.isArray(assertion[assertionName]);
}

function validateAssertions(path, assertions, callback) {
    for (let i = 0; i < assertions.length; i++) {
        validateAssertion(path + "." + (i + 1), assertions[i], callback);
    }
}

function validateAssertion(path, assertion, callback) {
    const assertionName = getAssertionName(assertion);
    if (!knownAssertions.includes(assertionName)) {
        callback({path: path, name: assertionName, tag: assertion, category: 'info', info: 'unknown assertion, ignoring it'});
    } else {
        const valid = vRef.validator(assertion)
        if (!valid) {
            callback({path: path, name: assertionName, tag: assertion, category: 'error', error: 'validation failed', errors: vRef.validator.errors});
        } else if (isCompositeAssertion(assertion, assertionName)) {
            validateAssertions(path, assertion[assertionName], callback);
        }
    }
}
