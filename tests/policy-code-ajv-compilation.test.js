// AI assistance has been used to generate some or all contents of this file.
// Tests that policy-code-schema.json compiles successfully in AJV 2020.

const Ajv2020 = require('ajv/dist/2020');
const fs = require('fs');
const path = require('path');
const tUtils = require("./utils");

const schemaVersion = tUtils.config().schemaVersion;
const SCHEMA_FILE = path.resolve(__dirname, '..', 'schema', schemaVersion, 'policy-code-schema.json');

let schema;

beforeAll(() => {
    schema = JSON.parse(fs.readFileSync(SCHEMA_FILE, 'utf8'));
});

describe('AJV 2020 Schema Compilation', () => {
    test('Schema compiles in strict mode or relaxed mode', () => {
        let compiled = false;
        try {
            const ajvStrict = new Ajv2020({ strict: true, allErrors: true });
            ajvStrict.compile(schema);
            compiled = true;
        } catch (e) {
            const ajvRelaxed = new Ajv2020({ strict: false, allErrors: true });
            const validate = ajvRelaxed.compile(schema);
            expect(typeof validate).toBe('function');
            compiled = true;
        }
        expect(compiled).toBe(true);
    });

    test('Schema has expected number of definitions and assertions', () => {
        expect(Object.keys(schema.definitions).length).toBeGreaterThan(100);
        expect(schema.oneOf.length).toBeGreaterThanOrEqual(190);
    });
});

describe('Individual Assertion Definition Compilation', () => {
    let assertionNames;

    beforeAll(() => {
        assertionNames = schema.oneOf.map(r => r.$ref.replace('schema:', ''));
    });

    test('All assertion definitions compile individually (with sub-type context)', () => {
        const failures = [];

        for (const name of assertionNames) {
            const def = Object.values(schema.definitions).find(d => d && d.$id === 'schema:' + name);
            if (!def) { failures.push(`${name}: definition not found`); continue; }

            try {
                const standalone = JSON.parse(JSON.stringify(def));
                delete standalone.$ref;

                const ajv = new Ajv2020({ strict: false, allErrors: true });
                // Pre-register all sub-type schemas so $ref resolution works
                for (const [, subDef] of Object.entries(schema.definitions)) {
                    if (subDef && subDef.$id && subDef.$id.startsWith('schema:sub-types/')) {
                        try { ajv.addSchema(subDef); } catch (e) { /* already added */ }
                    }
                    if (subDef && subDef.$id && subDef.$id.includes(':') && subDef.$id.includes(name + ':')) {
                        try { ajv.addSchema(subDef); } catch (e) { /* already added */ }
                    }
                }
                ajv.compile(standalone);
            } catch (e) {
                failures.push(`${name}: ${e.message.substring(0, 120)}`);
            }
        }

        expect(failures).toEqual([]);
    });
});

describe('Sample Policy Validation via AJV', () => {
    let validate;

    beforeAll(() => {
        const ajv = new Ajv2020({ strict: false, allErrors: true });
        validate = ajv.compile(schema);
    });

    test('Valid policy with Comment and SetVariable validates', () => {
        const policy = {
            All: [
                { Comment: "Test policy" },
                { SetVariable: { variable: "myVar", expression: "Hello", dataType: "string" } }
            ]
        };
        expect(validate(policy)).toBe(true);
    });

    test('Completely invalid structure fails validation', () => {
        const policy = { unknownAssertionXYZ: { variable: "myVar" } };
        expect(validate(policy)).toBe(false);
    });

    test('Realistic policy with Authentication and HttpRouting validates', () => {
        const policy = {
            All: [
                {
                    ".properties": { ".enabled": true },
                    Authentication: { identityProviderName: "Internal Identity Provider" }
                },
                {
                    HttpRouting: {
                        protectedServiceUrl: "https://backend.example.com/api",
                        tlsVersion: "TLSv1.2",
                        failOnErrorStatus: true
                    }
                },
                {
                    HardcodedResponse: {
                        body: "{\"status\":\"ok\"}",
                        contentType: "application/json",
                        status: "200",
                        earlyResponse: false
                    }
                }
            ]
        };
        const result = validate(policy);
        if (!result && validate.errors) {
            console.log('Validation errors:', validate.errors.slice(0, 3).map(e => `${e.instancePath}: ${e.message}`));
        }
        expect(result).toBe(true);
    });

    test('Graphman-client style compilation succeeds', () => {
        const ajv = new Ajv2020();
        const v = ajv.compile(schema);
        expect(typeof v).toBe('function');
    });
});
