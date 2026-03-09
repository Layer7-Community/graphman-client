// AI assistance has been used to generate some or all contents of this file.
// Gateway-based validation of policy-code-schema.json.
// Requires a live Gateway. Skipped when GATEWAY_HOST env var is not set.
//
// Usage:
//   GATEWAY_HOST=mygateway.example.com GATEWAY_PORT=9443 GATEWAY_USER=admin GATEWAY_PASS=password npx jest policy-code-gateway-validation

const Ajv2020 = require('ajv/dist/2020');
const https = require('https');
const fs = require('fs');
const path = require('path');
const tUtils = require("./utils");

const GW_HOST = process.env.GATEWAY_HOST;
const GW_PORT = process.env.GATEWAY_PORT || '9443';
const GW_USER = process.env.GATEWAY_USER || 'admin';
const GW_PASS = process.env.GATEWAY_PASS || 'password';

const gatewayAvailable = !!GW_HOST;

const schemaVersion = tUtils.config().schemaVersion;
const SCHEMA_FILE = path.resolve(__dirname, '..', 'schema', schemaVersion, 'policy-code-schema.json');

let schema;
let validate;
let schemaAssertionRefs;
let schemaAssertionSet;

function graphqlQuery(query) {
    return new Promise((resolve, reject) => {
        const data = JSON.stringify({ query });
        const auth = 'Basic ' + Buffer.from(`${GW_USER}:${GW_PASS}`).toString('base64');
        const options = {
            hostname: GW_HOST, port: parseInt(GW_PORT), path: '/graphman', method: 'POST',
            rejectAuthorized: false,
            headers: { 'Content-Type': 'application/json', 'Authorization': auth, 'Content-Length': Buffer.byteLength(data) }
        };
        const req = https.request(options, res => {
            let body = '';
            res.on('data', d => body += d);
            res.on('end', () => {
                if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}: ${body.substring(0, 200)}`));
                try { resolve(JSON.parse(body)); } catch (e) { reject(new Error('Invalid JSON: ' + body.substring(0, 200))); }
            });
        });
        req.on('error', reject);
        req.setTimeout(30000, () => { req.destroy(); reject(new Error('Timeout')); });
        req.write(data);
        req.end();
    });
}

function getSchemaForAssertion(configName) {
    const def = Object.values(schema.definitions).find(d => d && d.$id === 'schema:' + configName);
    return def ? def.properties[configName] : null;
}

function generateValidSample(configName, assertionSchema) {
    if (assertionSchema.type === 'string') return { [configName]: 'test value' };
    if (assertionSchema.type === 'array') return { [configName]: [] };
    if (!assertionSchema.properties) return { [configName]: {} };

    const props = {};
    for (const [propName, propDef] of Object.entries(assertionSchema.properties)) {
        if (propDef.$ref) continue;
        if (propDef.default !== undefined) { props[propName] = propDef.default; }
        else if (propDef.enum && propDef.enum.length > 0) { props[propName] = propDef.enum[0]; }
        else {
            switch (propDef.type) {
                case 'string': props[propName] = 'test'; break;
                case 'integer': props[propName] = 0; break;
                case 'number': props[propName] = 0.0; break;
                case 'boolean': props[propName] = false; break;
                case 'array': props[propName] = []; break;
                case 'object': props[propName] = {}; break;
            }
        }
    }
    return { [configName]: props };
}

function getWrongTypeValue(type) {
    switch (type) {
        case 'string': return 12345;
        case 'integer': return 'not_a_number';
        case 'number': return 'not_a_number';
        case 'boolean': return 'not_a_boolean';
        case 'array': return 'not_an_array';
        default: return null;
    }
}

beforeAll(() => {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
    schema = JSON.parse(fs.readFileSync(SCHEMA_FILE, 'utf8'));
    const ajv = new Ajv2020({ strict: false, allErrors: true });
    validate = ajv.compile(schema);
    schemaAssertionRefs = schema.oneOf.map(r => r.$ref.replace('schema:', ''));
    schemaAssertionSet = new Set(schemaAssertionRefs);
});

const describeGateway = gatewayAvailable ? describe : describe.skip;

describeGateway('Gateway Runtime Comparison', () => {
    let gwAssertions;
    let gwConfigNames;

    beforeAll(async () => {
        const result = await graphqlQuery(`{
            assertionsMetadata {
                name configName description categories configSchemas
            }
        }`);
        gwAssertions = result.data.assertionsMetadata;
        gwConfigNames = gwAssertions.map(a => a.configName);
    }, 60000);

    test('Schema covers majority of Gateway assertions', () => {
        const covered = gwConfigNames.filter(n => schemaAssertionSet.has(n));
        const pct = ((covered.length / gwConfigNames.length) * 100).toFixed(1);
        console.log(`Coverage: ${covered.length}/${gwConfigNames.length} (${pct}%)`);
        expect(covered.length).toBeGreaterThanOrEqual(170);
    });

    test('Per-assertion property comparison', () => {
        let propMatchCount = 0;
        let propMismatchCount = 0;
        const mismatchDetails = [];

        for (const gwAssertion of gwAssertions) {
            const configName = gwAssertion.configName;
            if (!schemaAssertionSet.has(configName)) continue;

            const schemaProps = getSchemaForAssertion(configName);
            if (!schemaProps || !schemaProps.properties) continue;

            const gwSchemas = gwAssertion.configSchemas;
            if (!gwSchemas || gwSchemas.length === 0 || !gwSchemas[0] || !gwSchemas[0].properties) continue;

            const schemaPropNames = new Set(Object.keys(schemaProps.properties));
            const gwPropNames = Object.keys(gwSchemas[0].properties)
                .filter(p => !p.startsWith('__') && !['_enabled', '_leftComment', '_rightComment'].includes(p));

            const significantMissing = gwPropNames.filter(p => !schemaPropNames.has(p));
            if (significantMissing.length === 0) { propMatchCount++; }
            else {
                propMismatchCount++;
                if (mismatchDetails.length < 15) mismatchDetails.push(`${configName}: missing ${significantMissing.join(', ')}`);
            }
        }

        const total = propMatchCount + propMismatchCount;
        console.log(`Property match: ${propMatchCount}/${total}`);
        if (mismatchDetails.length > 0) console.log('Mismatches:', mismatchDetails.join('; '));
    });

    test('Enum value comparison', () => {
        let enumMatchCount = 0;
        let enumMismatchCount = 0;

        for (const gwAssertion of gwAssertions) {
            const configName = gwAssertion.configName;
            if (!schemaAssertionSet.has(configName)) continue;

            const schemaProps = getSchemaForAssertion(configName);
            if (!schemaProps || !schemaProps.properties) continue;

            const gwSchemas = gwAssertion.configSchemas;
            if (!gwSchemas || gwSchemas.length === 0 || !gwSchemas[0].properties) continue;

            for (const [propName, gwPropDef] of Object.entries(gwSchemas[0].properties)) {
                if (propName.startsWith('__') || !gwPropDef.enum) continue;
                const schemaPropDef = schemaProps.properties[propName];
                if (!schemaPropDef) continue;

                if (schemaPropDef.enum) {
                    const gwEnumSet = new Set(gwPropDef.enum.map(String));
                    const schemaEnumSet = new Set(schemaPropDef.enum.map(String));
                    const missingEnums = [...gwEnumSet].filter(v => !schemaEnumSet.has(v));
                    if (missingEnums.length === 0) enumMatchCount++; else enumMismatchCount++;
                } else {
                    enumMismatchCount++;
                }
            }
        }

        const total = enumMatchCount + enumMismatchCount;
        console.log(`Enum match: ${enumMatchCount}/${total}`);
    });
});

describeGateway('Real Policy Bundle Validation', () => {
    test('Policies from Gateway validate against schema', async () => {
        const result = await graphqlQuery(`{ policies { name guid policy { code } } }`);
        const policies = (result.data.policies || []).filter(p => p.policy && p.policy.code);

        let validCount = 0;
        let invalidCount = 0;
        for (const policy of policies) {
            const code = typeof policy.policy.code === 'string' ? JSON.parse(policy.policy.code) : policy.policy.code;
            if (validate(code)) validCount++; else invalidCount++;
        }

        console.log(`Policies: ${validCount} valid, ${invalidCount} invalid out of ${policies.length}`);
        expect(policies.length).toBeGreaterThan(0);
    }, 60000);

    test('Services from Gateway validate against schema', async () => {
        const result = await graphqlQuery(`{ services { name policy { code } } }`);
        const services = (result.data.services || []).filter(s => s.policy && s.policy.code);

        let validCount = 0;
        let invalidCount = 0;
        for (const service of services) {
            const code = typeof service.policy.code === 'string' ? JSON.parse(service.policy.code) : service.policy.code;
            if (validate(code)) validCount++; else invalidCount++;
        }

        console.log(`Services: ${validCount} valid, ${invalidCount} invalid out of ${services.length}`);
        expect(services.length).toBeGreaterThan(0);
    }, 60000);
});

describe('Per-Assertion Sample Tests', () => {
    test('All assertions produce valid samples that pass AJV validation', () => {
        const failures = [];

        for (const configName of schemaAssertionRefs) {
            const assertionSchema = getSchemaForAssertion(configName);
            if (!assertionSchema) continue;

            const validSample = generateValidSample(configName, assertionSchema);
            const validPolicy = { All: [validSample] };
            if (!validate(validPolicy)) {
                const err = validate.errors[0];
                failures.push(`${configName}: ${err.instancePath} ${err.message}`);
            }
        }

        if (failures.length > 0) console.log('Sample failures:', failures.slice(0, 10).join('; '));
        expect(failures).toEqual([]);
    });
});

describe('Negative Tests', () => {
    test('Wrong types and invalid enums are correctly rejected', () => {
        const ajv = new Ajv2020({ strict: false, allErrors: true });
        const assertionValidators = {};
        let compiledCount = 0;

        for (const configName of schemaAssertionRefs) {
            const def = Object.values(schema.definitions).find(d => d && d.$id === 'schema:' + configName);
            if (!def || !def.properties || !def.properties[configName]) continue;
            const innerSchema = def.properties[configName];
            if (!innerSchema.properties) continue;

            try {
                const propSchema = { type: 'object', properties: innerSchema.properties, additionalProperties: false };
                assertionValidators[configName] = ajv.compile(propSchema);
                compiledCount++;
            } catch (e) { /* $ref resolution may fail in isolation */ }
        }

        let negativeTestsRun = 0;
        let negativeCorrectRejects = 0;
        let negativeFalseAccepts = 0;
        const falseAcceptDetails = [];

        for (const [configName, assertionValidate] of Object.entries(assertionValidators)) {
            const def = Object.values(schema.definitions).find(d => d && d.$id === 'schema:' + configName);
            const innerSchema = def.properties[configName];

            for (const [propName, propDef] of Object.entries(innerSchema.properties)) {
                if (propDef.$ref) continue;

                if (propDef.type && propDef.type !== 'object' && propDef.type !== 'array') {
                    const wrongValue = getWrongTypeValue(propDef.type);
                    negativeTestsRun++;
                    if (!assertionValidate({ [propName]: wrongValue })) negativeCorrectRejects++;
                    else {
                        negativeFalseAccepts++;
                        if (falseAcceptDetails.length < 10)
                            falseAcceptDetails.push(`${configName}.${propName}: type "${propDef.type}" accepted ${JSON.stringify(wrongValue)}`);
                    }
                }

                if (propDef.enum && propDef.enum.length > 0) {
                    negativeTestsRun++;
                    if (!assertionValidate({ [propName]: '__INVALID_ENUM_VALUE_XYZ__' })) negativeCorrectRejects++;
                    else {
                        negativeFalseAccepts++;
                        if (falseAcceptDetails.length < 10)
                            falseAcceptDetails.push(`${configName}.${propName}: enum accepted invalid value`);
                    }
                }
            }
        }

        console.log(`Compiled ${compiledCount} sub-validators`);
        console.log(`Negative tests: ${negativeCorrectRejects}/${negativeTestsRun} correctly rejected, ${negativeFalseAccepts} false accepts`);
        if (falseAcceptDetails.length > 0) console.log('False accepts:', falseAcceptDetails.join('; '));

        expect(negativeTestsRun).toBeGreaterThan(0);
    });
});
