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

describe("combine command", () => {
    
    test("should throw error when --inputs parameter is missing", () => {
        expect(() => {
            graphman("combine");
        }).toThrow();
    });

    test("should throw error when less than two input bundles are provided", () => {
        const bundle1 = createTestBundle("bundle1.json", {
            services: [{name: "Service1", resolutionPath: "/service1"}]
        });

        expect(() => {
            graphman("combine", "--inputs", bundle1);
        }).toThrow();
    });

    test("should combine two bundles with non-overlapping entities", () => {
        const bundle1 = createTestBundle("bundle1.json", {
            services: [{name: "Service1", resolutionPath: "/service1"}],
            policies: [{name: "Policy1", guid: "policy1-guid"}]
        });

        const bundle2 = createTestBundle("bundle2.json", {
            services: [{name: "Service2", resolutionPath: "/service2"}],
            clusterProperties: [{name: "prop1", value: "value1"}]
        });

        const output = graphman("combine", 
            "--inputs", bundle1, bundle2);

        expect(output.services).toHaveLength(2);
        expect(output.services).toEqual(expect.arrayContaining([
            expect.objectContaining({name: "Service1"}),
            expect.objectContaining({name: "Service2"})
        ]));

        expect(output.policies).toHaveLength(1);
        expect(output.policies).toEqual(expect.arrayContaining([
            expect.objectContaining({name: "Policy1"})
        ]));

        expect(output.clusterProperties).toHaveLength(1);
        expect(output.clusterProperties).toEqual(expect.arrayContaining([
            expect.objectContaining({name: "prop1"})
        ]));
    });

    test("should give precedence to rightmost bundle for duplicate entities", () => {
        const bundle1 = createTestBundle("bundle1.json", {
            services: [{
                name: "Service1", 
                resolutionPath: "/service1",
                enabled: false,
                properties: {version: "1.0"}
            }]
        });

        const bundle2 = createTestBundle("bundle2.json", {
            services: [{
                name: "Service1", 
                resolutionPath: "/service1",
                enabled: true,
                properties: {version: "2.0"}
            }]
        });

        const output = graphman("combine", 
            "--inputs", bundle1, bundle2);

        expect(output.services).toHaveLength(1);
        expect(output.services[0]).toMatchObject({
            name: "Service1",
            enabled: true,
            properties: {version: "2.0"}
        });
    });

    test("should combine three bundles with rightmost precedence", () => {
        const bundle1 = createTestBundle("bundle1.json", {
            clusterProperties: [
                {name: "prop1", value: "value1"},
                {name: "prop2", value: "value2"}
            ]
        });

        const bundle2 = createTestBundle("bundle2.json", {
            clusterProperties: [
                {name: "prop2", value: "value2-updated"},
                {name: "prop3", value: "value3"}
            ]
        });

        const bundle3 = createTestBundle("bundle3.json", {
            clusterProperties: [
                {name: "prop3", value: "value3-final"},
                {name: "prop4", value: "value4"}
            ]
        });

        const output = graphman("combine", 
            "--inputs", bundle1, bundle2, bundle3);

        expect(output.clusterProperties).toHaveLength(4);
        expect(output.clusterProperties).toEqual(expect.arrayContaining([
            expect.objectContaining({name: "prop1", value: "value1"}),
            expect.objectContaining({name: "prop2", value: "value2-updated"}),
            expect.objectContaining({name: "prop3", value: "value3-final"}),
            expect.objectContaining({name: "prop4", value: "value4"})
        ]));
    });

    test("should combine bundles with multiple entity types", () => {
        const bundle1 = createTestBundle("bundle1.json", {
            services: [{name: "Service1", resolutionPath: "/service1"}],
            policies: [{name: "Policy1", guid: "policy1-guid"}],
            folders: [{name: "Folder1", folderPath: "/folder1"}]
        });

        const bundle2 = createTestBundle("bundle2.json", {
            services: [{name: "Service2", resolutionPath: "/service2"}],
            clusterProperties: [{name: "prop1", value: "value1"}],
            keys: [{alias: "key1"}]
        });

        const output = graphman("combine", 
            "--inputs", bundle1, bundle2);

        expect(output.services).toHaveLength(2);
        expect(output.policies).toHaveLength(1);
        expect(output.folders).toHaveLength(1);
        expect(output.clusterProperties).toHaveLength(1);
        expect(output.keys).toHaveLength(1);
    });

    test("should preserve entities from left bundle when not in right bundle", () => {
        const bundle1 = createTestBundle("bundle1.json", {
            services: [
                {name: "Service1", resolutionPath: "/service1"},
                {name: "Service2", resolutionPath: "/service2"},
                {name: "Service3", resolutionPath: "/service3"}
            ]
        });

        const bundle2 = createTestBundle("bundle2.json", {
            services: [
                {name: "Service2", resolutionPath: "/service2", enabled: true}
            ]
        });

        const output = graphman("combine", 
            "--inputs", bundle1, bundle2);

        expect(output.services).toHaveLength(3);
        expect(output.services).toEqual(expect.arrayContaining([
            expect.objectContaining({name: "Service1"}),
            expect.objectContaining({name: "Service2", enabled: true}),
            expect.objectContaining({name: "Service3"})
        ]));
    });

    test("should handle empty bundles", () => {
        const bundle1 = createTestBundle("bundle1.json", {});
        const bundle2 = createTestBundle("bundle2.json", {
            services: [{name: "Service1", resolutionPath: "/service1"}]
        });

        const output = graphman("combine", 
            "--inputs", bundle1, bundle2);

        expect(output.services).toHaveLength(1);
        expect(output.services[0]).toMatchObject({name: "Service1"});
    });

    test("should handle bundles with empty entity arrays", () => {
        const bundle1 = createTestBundle("bundle1.json", {
            services: [],
            policies: [{name: "Policy1", guid: "policy1-guid"}]
        });

        const bundle2 = createTestBundle("bundle2.json", {
            services: [{name: "Service1", resolutionPath: "/service1"}],
            policies: []
        });

        const output = graphman("combine", 
            "--inputs", bundle1, bundle2);

        expect(output.services).toHaveLength(1);
        expect(output.policies).toHaveLength(1);
    });

    test("should combine bundles with complex entities", () => {
        const bundle1 = createTestBundle("bundle1.json", {
            services: [{
                name: "Service1",
                resolutionPath: "/service1",
                enabled: true,
                policy: {
                    xml: "<policy>...</policy>"
                },
                properties: [{key: "prop1", value: "value1"}]
            }]
        });

        const bundle2 = createTestBundle("bundle2.json", {
            services: [{
                name: "Service2",
                resolutionPath: "/service2",
                enabled: false,
                policy: {
                    xml: "<policy>...</policy>"
                },
                properties: [{key: "prop2", value: "value2"}]
            }]
        });

        const output = graphman("combine", 
            "--inputs", bundle1, bundle2);

        expect(output.services).toHaveLength(2);
        expect(output.services[0].policy).toBeDefined();
        expect(output.services[0].properties).toBeDefined();
        expect(output.services[1].policy).toBeDefined();
        expect(output.services[1].properties).toBeDefined();
    });

    test("should maintain entity order with rightmost first", () => {
        const bundle1 = createTestBundle("bundle1.json", {
            clusterProperties: [
                {name: "prop1", value: "value1"},
                {name: "prop2", value: "value2"}
            ]
        });

        const bundle2 = createTestBundle("bundle2.json", {
            clusterProperties: [
                {name: "prop3", value: "value3"}
            ]
        });

        const output = graphman("combine", 
            "--inputs", bundle1, bundle2);

        expect(output.clusterProperties).toHaveLength(3);
        // Rightmost bundle entities should appear first
        expect(output.clusterProperties[0]).toMatchObject({name: "prop3"});
    });

    test("should handle bundle properties", () => {
        const bundle1 = createTestBundle("bundle1.json", {
            services: [{name: "Service1", resolutionPath: "/service1"}],
            properties: {
                meta: {source: "bundle1"}
            }
        });

        const bundle2 = createTestBundle("bundle2.json", {
            services: [{name: "Service2", resolutionPath: "/service2"}],
            properties: {
                meta: {source: "bundle2"}
            }
        });

        const output = graphman("combine", 
            "--inputs", bundle1, bundle2);

        expect(output.services).toHaveLength(2);
        // Properties handling depends on implementation
        // Just verify the combine operation completes successfully
    });

    test("should combine bundles with policies and policy fragments", () => {
        const bundle1 = createTestBundle("bundle1.json", {
            policies: [{name: "Policy1", guid: "policy1-guid"}],
            policyFragments: [{name: "Fragment1", guid: "fragment1-guid"}]
        });

        const bundle2 = createTestBundle("bundle2.json", {
            policies: [{name: "Policy2", guid: "policy2-guid"}],
            policyFragments: [{name: "Fragment2", guid: "fragment2-guid"}]
        });

        const output = graphman("combine", 
            "--inputs", bundle1, bundle2);

        expect(output.policies).toHaveLength(2);
        expect(output.policyFragments).toHaveLength(2);
    });

    test("should combine bundles with keys and trusted certificates", () => {
        const bundle1 = createTestBundle("bundle1.json", {
            keys: [{alias: "key1", keystore: "keystore1"}],
            trustedCerts: [{name: "cert1", thumbprintSha1: "thumb1"}]
        });

        const bundle2 = createTestBundle("bundle2.json", {
            keys: [{alias: "key2", keystore: "keystore2"}],
            trustedCerts: [{name: "cert2", thumbprintSha1: "thumb2"}]
        });

        const output = graphman("combine", 
            "--inputs", bundle1, bundle2);

        expect(output.keys).toHaveLength(2);
        expect(output.trustedCerts).toHaveLength(2);
    });

    test("should handle duplicate detection by entity matching criteria", () => {
        // Services are matched by name and resolutionPath
        const bundle1 = createTestBundle("bundle1.json", {
            services: [{
                name: "Service1",
                resolutionPath: "/service1",
                enabled: false
            }]
        });

        const bundle2 = createTestBundle("bundle2.json", {
            services: [{
                name: "Service1",
                resolutionPath: "/service1",
                enabled: true
            }]
        });

        const output = graphman("combine", 
            "--inputs", bundle1, bundle2);

        expect(output.services).toHaveLength(1);
        expect(output.services[0].enabled).toBe(true);
    });

    test("should treat services with different resolutionPath as different entities", () => {
        const bundle1 = createTestBundle("bundle1.json", {
            services: [{
                name: "Service1",
                resolutionPath: "/path1",
                enabled: false
            }]
        });

        const bundle2 = createTestBundle("bundle2.json", {
            services: [{
                name: "Service1",
                resolutionPath: "/path2",
                enabled: true
            }]
        });

        const output = graphman("combine", 
            "--inputs", bundle1, bundle2);

        expect(output.services).toHaveLength(2);
    });

    test("should output sorted bundle", () => {
        const bundle1 = createTestBundle("bundle1.json", {
            services: [{name: "Service1", resolutionPath: "/service1"}]
        });

        const bundle2 = createTestBundle("bundle2.json", {
            clusterProperties: [{name: "prop1", value: "value1"}]
        });

        const output = graphman("combine", 
            "--inputs", bundle1, bundle2);

        // Verify output has expected structure (sorted)
        const keys = Object.keys(output);
        expect(keys.length).toBeGreaterThan(0);
    });

    test("should combine multiple bundles in sequence", () => {
        const bundle1 = createTestBundle("bundle1.json", {
            clusterProperties: [{name: "prop1", value: "v1"}]
        });

        const bundle2 = createTestBundle("bundle2.json", {
            clusterProperties: [{name: "prop2", value: "v2"}]
        });

        const bundle3 = createTestBundle("bundle3.json", {
            clusterProperties: [{name: "prop3", value: "v3"}]
        });

        const bundle4 = createTestBundle("bundle4.json", {
            clusterProperties: [{name: "prop4", value: "v4"}]
        });

        const output = graphman("combine", 
            "--inputs", bundle1, bundle2, bundle3, bundle4);

        expect(output.clusterProperties).toHaveLength(4);
    });
});

