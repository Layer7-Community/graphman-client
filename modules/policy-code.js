
const utils = require("./graphman-utils");
const vRef = {validator: null};
const knownAssertions = ["All", "OneOrMore", "Comment", "SetVariable", "Include", "Encapsulated", "HardcodedResponse"];

module.exports = {
    validate: function (entity, typeInfo, callback) {
        buildValidatorIfRequired();
        if (entity.policy) {
            if (entity.policy.json) validatePolicyCode(JSON.parse(entity.policy.json), callback);
            else if (entity.policy.code) validatePolicyCode(entity.policy.code, callback);
        }
    }
};

function buildValidatorIfRequired() {
    if (!vRef.validator) {
        const Ajv2020 = require("ajv/dist/2020");
        const ajv = new Ajv2020();
        vRef.validator = ajv.compile(utils.readFile(utils.policySchemaFile()));
    }
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
    } else if (isCompositeAssertion(assertion, assertionName)) {
        validateAssertions(path, assertion[assertionName], callback);
    } else {
        const valid = vRef.validator(assertion)
        if (!valid) {
            callback({path: path, name: assertionName, tag: assertion, category: 'error', error: 'validation failed', errors: vRef.validator.errors});
        }
    }
}
