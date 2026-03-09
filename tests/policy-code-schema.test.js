// AI assistance has been used to generate some or all contents of this file.
// Comprehensive test suite for policy-code-schema.json validation.

const fs = require('fs');
const path = require('path');
const tUtils = require("./utils");

const schemaVersion = tUtils.config().schemaVersion;
const SCHEMA_FILE = path.resolve(__dirname, '..', 'schema', schemaVersion, 'policy-code-schema.json');

let schema;

beforeAll(() => {
    const content = fs.readFileSync(SCHEMA_FILE, 'utf8');
    schema = JSON.parse(content);
});

function getAssertionSchema(name) {
    const def = Object.values(schema.definitions).find(d => d && d.$id === 'schema:' + name);
    return def ? def.properties[name] : null;
}

// ============================================================
// TEST SUITE 1: Schema File Integrity
// ============================================================
describe('Schema File Integrity', () => {
    test('Schema file exists', () => {
        expect(fs.existsSync(SCHEMA_FILE)).toBe(true);
    });

    test('Schema has top-level "definitions" object', () => {
        expect(schema.definitions).toBeDefined();
        expect(typeof schema.definitions).toBe('object');
    });

    test('Schema has top-level "oneOf" array', () => {
        expect(Array.isArray(schema.oneOf)).toBe(true);
    });

    test('Schema has base "assertion" definition', () => {
        const base = schema.definitions.assertion;
        expect(base).toBeDefined();
        expect(base.$id).toBe('schema:assertion');
        expect(base.type).toBe('object');
        expect(base.properties['.properties']).toBeDefined();
    });

    test('Schema has "assertionTypes" definition with oneOf', () => {
        const types = schema.definitions.assertionTypes;
        expect(types).toBeDefined();
        expect(types.$id).toBe('schema:assertionTypes');
        expect(Array.isArray(types.oneOf)).toBe(true);
    });

    test('Root oneOf matches assertionTypes oneOf', () => {
        const rootRefs = schema.oneOf.map(r => r.$ref).sort();
        const typeRefs = schema.definitions.assertionTypes.oneOf.map(r => r.$ref).sort();
        expect(rootRefs).toEqual(typeRefs);
    });
});

// ============================================================
// TEST SUITE 2: Assertion Definition Structure
// ============================================================
describe('Assertion Definition Structure', () => {
    let assertionRefs;
    let assertionNames;

    beforeAll(() => {
        assertionRefs = schema.oneOf.map(r => r.$ref);
        assertionNames = assertionRefs.map(r => r.replace('schema:', ''));
    });

    test('Has at least 190 assertions', () => {
        expect(assertionNames.length).toBeGreaterThanOrEqual(190);
    });

    test('Every oneOf $ref points to an existing definition', () => {
        const missing = assertionRefs.filter(ref => {
            return !Object.values(schema.definitions).some(def => def && def.$id === ref);
        });
        expect(missing).toEqual([]);
    });

    test('Every assertion definition has correct structure', () => {
        const errors = [];
        for (const name of assertionNames) {
            const def = Object.values(schema.definitions).find(d => d && d.$id === 'schema:' + name);
            if (!def) { errors.push(`${name}: definition not found`); continue; }
            if (def.type !== 'object') errors.push(`${name}: type should be "object", got "${def.type}"`);
            if (!def.$id) errors.push(`${name}: missing $id`);
            if (def.$ref !== 'schema:assertion') errors.push(`${name}: $ref should be "schema:assertion", got "${def.$ref}"`);
            if (!def.properties) errors.push(`${name}: missing properties`);
            if (!def.properties[name]) errors.push(`${name}: missing properties.${name}`);
            if (def.unevaluatedProperties !== false) errors.push(`${name}: unevaluatedProperties should be false`);
        }
        expect(errors).toEqual([]);
    });

    test('No assertion has UI-only properties (__ prefix)', () => {
        const violations = [];
        for (const name of assertionNames) {
            const def = Object.values(schema.definitions).find(d => d && d.$id === 'schema:' + name);
            if (!def || !def.properties[name] || !def.properties[name].properties) continue;
            const props = def.properties[name].properties;
            for (const propName of Object.keys(props)) {
                if (propName.startsWith('__')) {
                    violations.push(`${name}.${propName}`);
                }
            }
        }
        expect(violations).toEqual([]);
    });

    test('No assertion has i18n fields', () => {
        const violations = [];
        function checkForI18n(obj, path) {
            if (!obj || typeof obj !== 'object') return;
            if (Array.isArray(obj)) {
                obj.forEach((item, i) => checkForI18n(item, `${path}[${i}]`));
                return;
            }
            for (const [key, value] of Object.entries(obj)) {
                if (key === 'i18n') violations.push(path + '.i18n');
                if (typeof value === 'object') checkForI18n(value, `${path}.${key}`);
            }
        }
        checkForI18n(schema.definitions, 'definitions');
        expect(violations).toEqual([]);
    });
});

// ============================================================
// TEST SUITE 3: Known Assertions Present
// ============================================================
describe('Known Assertions Present', () => {
    let assertionRefs;

    beforeAll(() => {
        assertionRefs = schema.oneOf.map(r => r.$ref.replace('schema:', ''));
    });

    const criticalAssertions = [
        'SetVariable', 'HttpRouting', 'HardcodedResponse', 'Comment',
        'All', 'OneOrMore', 'Include', 'Encapsulated',
        'ForEachLoop', 'HandleErrors', 'ConcurrentAll',
        'True', 'False', 'RaiseError'
    ];

    test.each(criticalAssertions)('Critical assertion "%s" is present', (name) => {
        expect(assertionRefs).toContain(name);
    });

    const routingAssertions = [
        'HttpRouting', 'JmsRouting', 'MqNativeRouting', 'FtpRoutingAssertion',
        'SimpleRawTransport', 'Http2Routing', 'SshRouteAssertion',
        'KafkaRouting', 'EchoRoutingAssertion'
    ];

    test.each(routingAssertions)('Routing assertion "%s" is present', (name) => {
        expect(assertionRefs).toContain(name);
    });

    const securityAssertions = [
        'Ssl', 'WssBasic', 'WssDigest', 'RequireWssX509Cert',
        'Authentication', 'DecodeJsonWebToken', 'EncodeJsonWebToken',
        'JwtDecode', 'JwtEncode', 'CORS', 'SqlAttack',
        'CodeInjectionProtection', 'SchemaValidation'
    ];

    test.each(securityAssertions)('Security assertion "%s" is present', (name) => {
        expect(assertionRefs).toContain(name);
    });
});

// ============================================================
// TEST SUITE 4: Property Type Correctness
// ============================================================
describe('Property Type Correctness', () => {
    const validTypes = ['string', 'integer', 'number', 'boolean', 'object', 'array'];

    test('All property types are valid JSON Schema types', () => {
        const errors = [];
        function checkTypes(obj, path, depth) {
            if (!obj || typeof obj !== 'object' || depth > 6) return;
            if (Array.isArray(obj)) {
                obj.forEach((item, i) => checkTypes(item, `${path}[${i}]`, depth + 1));
                return;
            }
            if (obj.type !== undefined) {
                if (typeof obj.type === 'string' && !validTypes.includes(obj.type)) {
                    errors.push(`${path}: invalid type "${obj.type}"`);
                } else if (Array.isArray(obj.type)) {
                    for (const t of obj.type) {
                        if (!validTypes.includes(t) && t !== 'null') {
                            errors.push(`${path}: invalid type in union "${t}"`);
                        }
                    }
                }
            }
            for (const [key, value] of Object.entries(obj)) {
                if (key === 'properties' && typeof value === 'object' && !Array.isArray(value)) {
                    for (const [propName, propDef] of Object.entries(value)) {
                        checkTypes(propDef, `${path}.properties.${propName}`, depth + 1);
                    }
                } else if (key === 'items' && typeof value === 'object') {
                    checkTypes(value, `${path}.items`, depth + 1);
                }
            }
        }
        for (const [defName, def] of Object.entries(schema.definitions)) {
            checkTypes(def, `definitions.${defName}`, 0);
        }
        expect(errors).toEqual([]);
    });

    test('All $ref values point to existing definitions or local $defs', () => {
        const definedIds = new Set();
        for (const def of Object.values(schema.definitions)) {
            if (def && def.$id) definedIds.add(def.$id);
        }

        const errors = [];
        function checkRefs(obj, path) {
            if (!obj || typeof obj !== 'object') return;
            if (Array.isArray(obj)) {
                obj.forEach((item, i) => checkRefs(item, `${path}[${i}]`));
                return;
            }
            if (obj.$ref && obj.$ref !== 'schema:assertion' && obj.$ref !== 'schema:assertionTypes') {
                if (!obj.$ref.startsWith('#/') && !definedIds.has(obj.$ref)) {
                    errors.push(`${path}: $ref "${obj.$ref}" not found`);
                }
            }
            for (const [key, value] of Object.entries(obj)) {
                if (key !== '$ref' && typeof value === 'object') checkRefs(value, `${path}.${key}`);
            }
        }
        checkRefs(schema.definitions, 'definitions');
        expect(errors).toEqual([]);
    });

    test('Enum values are arrays with at least one element', () => {
        const errors = [];
        function checkEnums(obj, path) {
            if (!obj || typeof obj !== 'object') return;
            if (Array.isArray(obj)) {
                obj.forEach((item, i) => checkEnums(item, `${path}[${i}]`));
                return;
            }
            if (obj.enum !== undefined) {
                if (!Array.isArray(obj.enum)) errors.push(`${path}: enum is not an array`);
                else if (obj.enum.length === 0) errors.push(`${path}: enum is empty`);
            }
            for (const [key, value] of Object.entries(obj)) {
                if (typeof value === 'object') checkEnums(value, `${path}.${key}`);
            }
        }
        checkEnums(schema.definitions, 'definitions');
        expect(errors).toEqual([]);
    });

    test('Default values match their declared types', () => {
        const errors = [];
        function checkDefaults(obj, path) {
            if (!obj || typeof obj !== 'object') return;
            if (Array.isArray(obj)) {
                obj.forEach((item, i) => checkDefaults(item, `${path}[${i}]`));
                return;
            }
            if (obj.default !== undefined && obj.type) {
                const defType = typeof obj.default;
                let valid = false;
                switch (obj.type) {
                    case 'string': valid = defType === 'string'; break;
                    case 'integer': case 'number': valid = defType === 'number'; break;
                    case 'boolean': valid = defType === 'boolean'; break;
                    case 'object': valid = defType === 'object' && !Array.isArray(obj.default); break;
                    case 'array': valid = Array.isArray(obj.default); break;
                    default: valid = true;
                }
                if (!valid) {
                    errors.push(`${path}: default ${JSON.stringify(obj.default)} (${defType}) doesn't match type "${obj.type}"`);
                }
            }
            if (obj.default !== undefined && obj.enum) {
                if (!obj.enum.includes(obj.default)) {
                    errors.push(`${path}: default ${JSON.stringify(obj.default)} not in enum ${JSON.stringify(obj.enum)}`);
                }
            }
            for (const [key, value] of Object.entries(obj)) {
                if (typeof value === 'object') checkDefaults(value, `${path}.${key}`);
            }
        }
        checkDefaults(schema.definitions, 'definitions');
        expect(errors).toEqual([]);
    });

    test('Required fields reference existing properties', () => {
        const errors = [];
        const assertionRefs = schema.oneOf.map(r => r.$ref.replace('schema:', ''));
        for (const name of assertionRefs) {
            const def = Object.values(schema.definitions).find(d => d && d.$id === 'schema:' + name);
            if (!def || !def.properties[name]) continue;
            const inner = def.properties[name];
            if (inner.required && inner.properties) {
                for (const req of inner.required) {
                    if (!inner.properties[req]) {
                        errors.push(`${name}: required field "${req}" not in properties`);
                    }
                }
            }
        }
        expect(errors).toEqual([]);
    });
});

// ============================================================
// TEST SUITE 5: Specific Assertion Schema Validation
// ============================================================
describe('Specific Assertion Schema Validation', () => {
    test('SetVariable has correct properties', () => {
        const sv = getAssertionSchema('SetVariable');
        expect(sv).toBeDefined();
        expect(sv.properties.variable).toBeDefined();
        expect(sv.properties.expression).toBeDefined();
        expect(sv.properties.dataType).toBeDefined();
        expect(sv.properties.contentType).toBeDefined();
        expect(sv.properties.lineBreak).toBeDefined();
        expect(sv.properties.dateFormat).toBeDefined();
        expect(sv.properties.dateOffsetExpression).toBeDefined();
        expect(sv.properties.dateOffsetField).toBeDefined();
    });

    test('SetVariable.dataType has correct enum', () => {
        const sv = getAssertionSchema('SetVariable');
        expect(sv.properties.dataType.enum).toBeDefined();
        expect(sv.properties.dataType.enum).toContain('string');
        expect(sv.properties.dataType.enum).toContain('message');
        expect(sv.properties.dataType.enum).toContain('dateTime');
        expect(sv.properties.dataType.enum).toContain('int');
    });

    test('SetVariable.lineBreak has correct enum', () => {
        const sv = getAssertionSchema('SetVariable');
        expect(sv.properties.lineBreak.enum).toBeDefined();
        expect(sv.properties.lineBreak.enum).toContain('LF');
        expect(sv.properties.lineBreak.enum).toContain('CR');
    });

    test('SetVariable.variable is string type', () => {
        const sv = getAssertionSchema('SetVariable');
        expect(sv.properties.variable.type).toBe('string');
    });

    test('HttpRouting has 60+ properties', () => {
        const hr = getAssertionSchema('HttpRouting');
        expect(hr).toBeDefined();
        expect(Object.keys(hr.properties).length).toBeGreaterThanOrEqual(60);
    });

    test('HttpRouting has key enum properties', () => {
        const hr = getAssertionSchema('HttpRouting');
        expect(hr.properties.tlsVersion.enum).toContain('TLSv1.2');
        expect(hr.properties.tlsVersion.enum).toContain('TLSv1.3');
        expect(hr.properties.failoverStrategyName.enum).toContain('ordered');
    });

    test('HttpRouting has $ref properties for sub-types', () => {
        const hr = getAssertionSchema('HttpRouting');
        expect(hr.properties.requestHeaderRules.$ref).toBeDefined();
        expect(hr.properties.responseHeaderRules.$ref).toBeDefined();
        expect(hr.properties.recipientContext.$ref).toBeDefined();
    });

    test('HardcodedResponse has correct properties', () => {
        const hr = getAssertionSchema('HardcodedResponse');
        expect(hr).toBeDefined();
        expect(hr.properties.body).toBeDefined();
        expect(hr.properties.contentType).toBeDefined();
        expect(hr.properties.earlyResponse).toBeDefined();
        expect(hr.properties.status).toBeDefined();
        expect(hr.properties.earlyResponse.type).toBe('boolean');
    });

    test('HardcodedResponse.status is string type', () => {
        const hr = getAssertionSchema('HardcodedResponse');
        expect(hr.properties.status.type).toBe('string');
    });

    test('Comment is a string type', () => {
        const def = schema.definitions.comment;
        expect(def).toBeDefined();
        expect(def.properties.Comment.type).toBe('string');
    });

    test('Include has policyName as required', () => {
        const inc = getAssertionSchema('Include');
        expect(inc).toBeDefined();
        expect(inc.properties.policyName).toBeDefined();
        expect(inc.required).toContain('policyName');
    });

    test('Encapsulated has encassName as required', () => {
        const enc = getAssertionSchema('Encapsulated');
        expect(enc).toBeDefined();
        expect(enc.properties.encassName).toBeDefined();
        expect(enc.required).toContain('encassName');
    });

    test('All is an array type (composite)', () => {
        const def = schema.definitions.all;
        expect(def).toBeDefined();
        expect(def.properties.All.type).toBe('array');
    });

    test('OneOrMore is an array type (composite)', () => {
        const def = schema.definitions.oneOrMore;
        expect(def).toBeDefined();
        expect(def.properties.OneOrMore.type).toBe('array');
    });

    test('DecodeJsonWebToken has validationType enum', () => {
        const djwt = getAssertionSchema('DecodeJsonWebToken');
        expect(djwt).toBeDefined();
        expect(djwt.properties.validationType).toBeDefined();
        expect(djwt.properties.validationType.enum).toBeDefined();
    });

    test('EncodeJsonWebToken has 20+ properties', () => {
        const ejwt = getAssertionSchema('EncodeJsonWebToken');
        expect(ejwt).toBeDefined();
        expect(Object.keys(ejwt.properties).length).toBeGreaterThanOrEqual(20);
    });

    test('Ssl has properties', () => {
        const ssl = getAssertionSchema('Ssl');
        expect(ssl).toBeDefined();
        expect(ssl.properties).toBeDefined();
    });

    test('CORS has 10+ properties', () => {
        const cors = getAssertionSchema('CORS');
        expect(cors).toBeDefined();
        expect(Object.keys(cors.properties).length).toBeGreaterThanOrEqual(10);
    });
});

// ============================================================
// TEST SUITE 6: Sub-Type Schema Validation
// ============================================================
describe('Sub-Type Schema Validation', () => {
    test('xmlSecurityRecipientContext sub-type exists', () => {
        const st = schema.definitions.xmlSecurityRecipientContext;
        expect(st).toBeDefined();
        expect(st.properties.actor).toBeDefined();
    });

    test('httpPassthroughRuleSet sub-type exists', () => {
        const names = Object.keys(schema.definitions);
        const found = names.find(n => n.toLowerCase().includes('httppassthroughruleset'));
        expect(found).toBeDefined();
        expect(schema.definitions[found].properties).toBeDefined();
    });

    test('httpPassthroughRule sub-type exists', () => {
        const names = Object.keys(schema.definitions);
        const found = names.find(n => n.toLowerCase() === 'httppassthroughrule');
        expect(found).toBeDefined();
    });

    test('goid sub-type exists', () => {
        const st = schema.definitions.goid;
        expect(st).toBeDefined();
        expect(st.type).toBe('string');
    });

    test('identityTarget sub-type exists', () => {
        const st = schema.definitions.identityTarget;
        expect(st).toBeDefined();
        expect(st.properties).toBeDefined();
    });

    test('Sub-type schemas have $id', () => {
        const assertionNames = schema.oneOf.map(r => r.$ref.replace('schema:', ''));
        const assertionCamelNames = new Set(assertionNames.map(n => n.charAt(0).toLowerCase() + n.slice(1)));
        assertionCamelNames.add('assertion');
        assertionCamelNames.add('assertionTypes');

        const errors = [];
        for (const [name, def] of Object.entries(schema.definitions)) {
            if (assertionCamelNames.has(name)) continue;
            if (!def.$id) errors.push(name);
        }
        expect(errors).toEqual([]);
    });
});

// ============================================================
// TEST SUITE 7: Sample Policy Code Validation (Structural)
// ============================================================
describe('Sample Policy Code Validation', () => {
    function validateAssertionProperties(assertionName, props) {
        const assertionSchema = getAssertionSchema(assertionName);
        if (!assertionSchema || !assertionSchema.properties) return { valid: true, errors: [] };

        const errors = [];
        for (const [propName, propValue] of Object.entries(props)) {
            const propSchema = assertionSchema.properties[propName];
            if (!propSchema) {
                errors.push(`Unknown property "${propName}" in ${assertionName}`);
                continue;
            }
            if (propSchema.type) {
                const actualType = Array.isArray(propValue) ? 'array' : typeof propValue;
                const expectedType = propSchema.type === 'integer' ? 'number' : propSchema.type;
                if (actualType !== expectedType && !(propSchema.type === 'integer' && actualType === 'number')) {
                    errors.push(`${assertionName}.${propName}: expected type "${propSchema.type}", got "${actualType}"`);
                }
            }
            if (propSchema.enum && !propSchema.enum.includes(propValue)) {
                errors.push(`${assertionName}.${propName}: value ${JSON.stringify(propValue)} not in enum`);
            }
        }
        if (assertionSchema.required) {
            for (const req of assertionSchema.required) {
                if (props[req] === undefined) {
                    errors.push(`${assertionName}: missing required property "${req}"`);
                }
            }
        }
        return { valid: errors.length === 0, errors };
    }

    test('Valid SetVariable passes validation', () => {
        const result = validateAssertionProperties('SetVariable', {
            variable: 'myVar', expression: 'Hello World', dataType: 'string', lineBreak: 'LF'
        });
        expect(result.valid).toBe(true);
    });

    test('SetVariable with invalid dataType is caught', () => {
        const result = validateAssertionProperties('SetVariable', {
            variable: 'myVar', expression: 'test', dataType: 'INVALID_TYPE'
        });
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.includes('dataType'))).toBe(true);
    });

    test('SetVariable with wrong type for dataType is caught', () => {
        const result = validateAssertionProperties('SetVariable', {
            variable: 'test', expression: 'test', dataType: 123
        });
        expect(result.valid).toBe(false);
    });

    test('Valid HardcodedResponse passes validation', () => {
        const result = validateAssertionProperties('HardcodedResponse', {
            body: '<html>OK</html>', contentType: 'text/html', status: '200', earlyResponse: false
        });
        expect(result.valid).toBe(true);
    });

    test('HardcodedResponse with wrong type for earlyResponse is caught', () => {
        const result = validateAssertionProperties('HardcodedResponse', {
            body: '<html>OK</html>', contentType: 'text/html', status: '200', earlyResponse: 'yes'
        });
        expect(result.valid).toBe(false);
    });

    test('Valid Include passes validation', () => {
        const result = validateAssertionProperties('Include', { policyName: 'My Policy Fragment' });
        expect(result.valid).toBe(true);
    });

    test('Include missing policyName is caught', () => {
        const result = validateAssertionProperties('Include', { policyGuid: 'some-guid' });
        expect(result.valid).toBe(false);
    });

    test('Valid HttpRouting passes validation', () => {
        const result = validateAssertionProperties('HttpRouting', {
            protectedServiceUrl: 'https://backend.example.com/api',
            tlsVersion: 'TLSv1.2', failoverStrategyName: 'ordered',
            failOnErrorStatus: true, followRedirects: false
        });
        expect(result.valid).toBe(true);
    });

    test('HttpRouting with invalid tlsVersion is caught', () => {
        const result = validateAssertionProperties('HttpRouting', {
            protectedServiceUrl: 'https://example.com', tlsVersion: 'SSL3.0'
        });
        expect(result.valid).toBe(false);
    });

    test('Unknown property in SetVariable is caught', () => {
        const result = validateAssertionProperties('SetVariable', {
            variable: 'myVar', expression: 'test', nonExistentProperty: 'value'
        });
        expect(result.valid).toBe(false);
    });
});

// ============================================================
// TEST SUITE 8: Full Policy Bundle Validation
// ============================================================
describe('Full Policy Bundle Structural Validation', () => {
    function validatePolicyCode(code) {
        const errors = [];
        const allChildren = code['All'];
        if (!Array.isArray(allChildren)) {
            return { valid: false, errors: ['Root must be All with array children'] };
        }

        const assertionRefSet = new Set(schema.oneOf.map(r => r.$ref.replace('schema:', '')));

        function validateAssertion(assertion, path) {
            const assertionName = Object.keys(assertion).find(k => k !== '.properties');
            if (!assertionName) { errors.push(`${path}: no assertion name found`); return; }
            if (!assertionRefSet.has(assertionName)) { errors.push(`${path}: unknown assertion "${assertionName}"`); return; }
            const value = assertion[assertionName];
            if (Array.isArray(value)) {
                value.forEach((child, i) => validateAssertion(child, `${path}.${i + 1}`));
            }
        }

        allChildren.forEach((child, i) => validateAssertion(child, `1.${i + 1}`));
        return { valid: errors.length === 0, errors };
    }

    test('Complex policy with mixed assertions validates', () => {
        const policy = {
            All: [
                { SetVariable: { variable: 'requestTime', expression: '${gateway.time}', dataType: 'string' } },
                { Authentication: { identityProviderName: 'Internal Identity Provider' } },
                { OneOrMore: [
                    { HttpRouting: { protectedServiceUrl: 'https://primary.example.com/api', tlsVersion: 'TLSv1.2' } },
                    { HttpRouting: { protectedServiceUrl: 'https://fallback.example.com/api', tlsVersion: 'TLSv1.2' } }
                ]},
                { HardcodedResponse: { body: '{"status":"ok"}', contentType: 'application/json', status: '200' } }
            ]
        };
        expect(validatePolicyCode(policy).valid).toBe(true);
    });

    test('Policy with nested composites validates', () => {
        const policy = {
            All: [
                { Comment: 'Start of policy' },
                { HandleErrors: { All: [{ SetVariable: { variable: 'errorMsg', expression: 'An error occurred', dataType: 'string' } }] } },
                { ForEachLoop: { loopVariable: 'items', iterationLimit: '100', variablePrefix: 'item' } }
            ]
        };
        expect(validatePolicyCode(policy).valid).toBe(true);
    });

    test('Policy with .properties validates', () => {
        const policy = {
            All: [
                { '.properties': { '.enabled': true, '.left.comment': 'This is a comment' }, SetVariable: { variable: 'test', expression: 'value' } },
                { '.properties': { '.enabled': false }, Comment: 'Disabled assertion' }
            ]
        };
        expect(validatePolicyCode(policy).valid).toBe(true);
    });

    test('Policy with unknown assertion name is caught', () => {
        const policy = { All: [{ NonExistentAssertion: { someProperty: 'value' } }] };
        expect(validatePolicyCode(policy).valid).toBe(false);
    });

    test('Policy without root All fails', () => {
        const policy = { SetVariable: { variable: 'test', expression: 'value' } };
        expect(validatePolicyCode(policy).valid).toBe(false);
    });
});

// ============================================================
// TEST SUITE 9: No Duplicate $id Values
// ============================================================
describe('Schema Uniqueness', () => {
    test('No duplicate $id values in definitions', () => {
        const ids = {};
        const duplicates = [];
        for (const [name, def] of Object.entries(schema.definitions)) {
            if (def && def.$id) {
                if (ids[def.$id]) {
                    duplicates.push(`$id "${def.$id}" used by both "${ids[def.$id]}" and "${name}"`);
                } else {
                    ids[def.$id] = name;
                }
            }
        }
        expect(duplicates).toEqual([]);
    });

    test('No duplicate definition keys', () => {
        const keys = Object.keys(schema.definitions);
        expect(keys.length).toBe(new Set(keys).size);
    });

    test('No duplicate $ref in oneOf', () => {
        const refs = schema.oneOf.map(r => r.$ref);
        expect(refs.length).toBe(new Set(refs).size);
    });
});
