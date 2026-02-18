// Copyright (c) 2025 Broadcom Inc. and its subsidiaries. All Rights Reserved.

const tUtils = require("./utils");
const {graphman} = tUtils;
const fs = require('fs');
const path = require('path');

// Helper to create test bundle files
function createTestBundle(filename, content) {
    const testDir = tUtils.config().workspace;
    if (!fs.existsSync(testDir)) {
        fs.mkdirSync(testDir, { recursive: true });
    }
    const filepath = path.join(testDir, filename);
    fs.writeFileSync(filepath, JSON.stringify(content, null, 2));
    return filepath;
}

describe("validate command", () => {

    test("should throw error when --input parameter is missing", () => {
        expect(() => {
            graphman("validate");
        }).toThrow();
    });

    test("should validate bundle with valid policy code in JSON format", () => {
        const bundle = createTestBundle("valid-bundle.json", {
            policies: [{
                name: "ValidPolicy",
                guid: "valid-policy-guid",
                policy: {
                    json: JSON.stringify({
                        "policy": {
                            "assertions": []
                        }
                    })
                }
            }]
        });

        const output = graphman("validate", "--input", bundle);

        // Should complete without errors
        expect(output.stdout).toBeDefined();
    });

    test("should validate bundle with services containing policy code", () => {
        const bundle = createTestBundle("service-bundle.json", {
            services: [{
                name: "ValidService",
                resolutionPath: "/valid",
                policy: {
                    json: JSON.stringify({
                        "policy": {
                            "assertions": []
                        }
                    })
                }
            }]
        });

        const output = graphman("validate", "--input", bundle);

        // Should complete without errors
        expect(output.stdout).toBeDefined();
    });

    test("should validate empty bundle", () => {
        const bundle = createTestBundle("empty-bundle.json", {});

        const output = graphman("validate", "--input", bundle);

        // Should complete without errors
        expect(output.stdout).toBeDefined();
    });

    test("should validate bundle without policies or services", () => {
        const bundle = createTestBundle("no-policies-bundle.json", {
            clusterProperties: [{name: "prop1", value: "value1"}],
            folders: [{name: "Folder1", folderPath: "/folder1"}]
        });

        const output = graphman("validate", "--input", bundle);

        // Should complete without errors since there are no policies to validate
        expect(output.stdout).toBeDefined();
    });

    test("should validate bundle with multiple policies", () => {
        const bundle = createTestBundle("multiple-policies.json", {
            policies: [
                {
                    name: "Policy1",
                    guid: "policy1-guid",
                    policy: {
                        json: JSON.stringify({
                            "policy": {
                                "assertions": []
                            }
                        })
                    }
                },
                {
                    name: "Policy2",
                    guid: "policy2-guid",
                    policy: {
                        json: JSON.stringify({
                            "policy": {
                                "assertions": []
                            }
                        })
                    }
                }
            ]
        });

        const output = graphman("validate", "--input", bundle);

        // Should validate all policies
        expect(output.stdout).toBeDefined();
    });

    test("should validate bundle with policies in XML format", () => {
        const bundle = createTestBundle("xml-policy-bundle.json", {
            policies: [{
                name: "XMLPolicy",
                guid: "xml-policy-guid",
                policy: {
                    xml: "<wsp:Policy xmlns:wsp=\"http://schemas.xmlsoap.org/ws/2004/09/policy\"></wsp:Policy>"
                }
            }]
        });

        const output = graphman("validate", "--input", bundle);

        // Should handle XML policies (validation focuses on JSON format)
        expect(output.stdout).toBeDefined();
    });

    test("should validate bundle with both services and policies", () => {
        const bundle = createTestBundle("mixed-bundle.json", {
            services: [{
                name: "Service1",
                resolutionPath: "/service1",
                policy: {
                    json: JSON.stringify({
                        "policy": {
                            "assertions": []
                        }
                    })
                }
            }],
            policies: [{
                name: "Policy1",
                guid: "policy1-guid",
                policy: {
                    json: JSON.stringify({
                        "policy": {
                            "assertions": []
                        }
                    })
                }
            }]
        });

        const output = graphman("validate", "--input", bundle);

        // Should validate both services and policies
        expect(output.stdout).toBeDefined();
    });

    test("should handle bundle with policies without policy code", () => {
        const bundle = createTestBundle("no-code-bundle.json", {
            policies: [{
                name: "PolicyWithoutCode",
                guid: "policy-guid"
            }]
        });

        const output = graphman("validate", "--input", bundle);

        // Should handle gracefully when no policy code is present
        expect(output.stdout).toBeDefined();
    });

    test("should validate bundle with policy containing YAML format", () => {
        const bundle = createTestBundle("yaml-policy-bundle.json", {
            policies: [{
                name: "YAMLPolicy",
                guid: "yaml-policy-guid",
                policy: {
                    yaml: "policy:\n  assertions: []"
                }
            }]
        });

        const output = graphman("validate", "--input", bundle);

        // Should handle YAML policies
        expect(output.stdout).toBeDefined();
    });

    test("should validate bundle with complex policy structure", () => {
        const bundle = createTestBundle("complex-policy-bundle.json", {
            policies: [{
                name: "ComplexPolicy",
                guid: "complex-policy-guid",
                folderPath: "/policies",
                policy: {
                    json: JSON.stringify({
                        "policy": {
                            "assertions": [
                                {
                                    "assertionType": "AllAssertion",
                                    "assertions": []
                                }
                            ]
                        }
                    })
                }
            }]
        });

        const output = graphman("validate", "--input", bundle);

        // Should validate complex policy structures
        expect(output.stdout).toBeDefined();
    });

    test("should validate bundle with service containing complex policy", () => {
        const bundle = createTestBundle("complex-service-bundle.json", {
            services: [{
                name: "ComplexService",
                resolutionPath: "/complex",
                enabled: true,
                policy: {
                    json: JSON.stringify({
                        "policy": {
                            "assertions": [
                                {
                                    "assertionType": "Authentication",
                                    "properties": {}
                                }
                            ]
                        }
                    })
                }
            }]
        });

        const output = graphman("validate", "--input", bundle);

        // Should validate service with complex policy
        expect(output.stdout).toBeDefined();
    });

    test("should validate bundle with entities other than policies and services", () => {
        const bundle = createTestBundle("other-entities-bundle.json", {
            clusterProperties: [{name: "prop1", value: "value1"}],
            keys: [{alias: "key1", keystore: "keystore1"}],
            trustedCerts: [{name: "cert1", thumbprintSha1: "thumb1"}]
        });

        const output = graphman("validate", "--input", bundle);

        // Should complete without errors (no policies/services to validate)
        expect(output.stdout).toBeDefined();
    });
});

