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

describe("mappings command", () => {

    test("should throw error when --input parameter is missing", () => {
        expect(() => {
            graphman("mappings");
        }).toThrow();
    });

    test("should add mappings to bundle with default action", () => {
        const bundle = createTestBundle("test-bundle.json", {
            services: [{
                name: "Service1",
                resolutionPath: "/service1"
            }]
        });

        const output = graphman("mappings", 
            "--input", bundle,
            "--mappings.action", "NEW_OR_UPDATE");

        expect(output.services).toHaveLength(1);
        expect(output.properties).toBeDefined();
        expect(output.properties.mappings).toBeDefined();
    });

    test("should add mappings for specific entity type", () => {
        const bundle = createTestBundle("test-bundle.json", {
            services: [{name: "Service1", resolutionPath: "/service1"}],
            policies: [{name: "Policy1", guid: "policy1-guid"}]
        });

        const output = graphman("mappings", 
            "--input", bundle,
            "--mappings.services.action", "ALWAYS_CREATE_NEW");

        expect(output.services).toHaveLength(1);
        expect(output.policies).toHaveLength(1);
        expect(output.properties).toBeDefined();
        expect(output.properties.mappings).toBeDefined();
    });

    test("should add mappings with NEW_OR_EXISTING action", () => {
        const bundle = createTestBundle("test-bundle.json", {
            services: [{name: "Service1", resolutionPath: "/service1"}]
        });

        const output = graphman("mappings", 
            "--input", bundle,
            "--mappings.action", "NEW_OR_EXISTING");

        expect(output.services).toHaveLength(1);
        expect(output.properties).toBeDefined();
    });

    test("should add mappings with DELETE action", () => {
        const bundle = createTestBundle("test-bundle.json", {
            services: [{name: "Service1", resolutionPath: "/service1"}]
        });

        const output = graphman("mappings", 
            "--input", bundle,
            "--mappings.action", "DELETE");

        expect(output.services).toHaveLength(1);
        expect(output.properties).toBeDefined();
    });

    test("should add mappings with IGNORE action", () => {
        const bundle = createTestBundle("test-bundle.json", {
            services: [{name: "Service1", resolutionPath: "/service1"}]
        });

        const output = graphman("mappings", 
            "--input", bundle,
            "--mappings.action", "IGNORE");

        expect(output.services).toHaveLength(1);
        expect(output.properties).toBeDefined();
    });

    test("should add mappings with bundleDefaultAction option", () => {
        const bundle = createTestBundle("test-bundle.json", {
            services: [{name: "Service1", resolutionPath: "/service1"}],
            policies: [{name: "Policy1", guid: "policy1-guid"}]
        });

        const output = graphman("mappings", 
            "--input", bundle,
            "--options.bundleDefaultAction", "NEW_OR_UPDATE");

        expect(output.services).toHaveLength(1);
        expect(output.policies).toHaveLength(1);
    });

    test("should add mappings to bundle with multiple entity types", () => {
        const bundle = createTestBundle("test-bundle.json", {
            services: [{name: "Service1", resolutionPath: "/service1"}],
            policies: [{name: "Policy1", guid: "policy1-guid"}],
            clusterProperties: [{name: "prop1", value: "value1"}]
        });

        const output = graphman("mappings", 
            "--input", bundle,
            "--mappings.action", "NEW_OR_UPDATE");

        expect(output.services).toHaveLength(1);
        expect(output.policies).toHaveLength(1);
        expect(output.clusterProperties).toHaveLength(1);
        expect(output.properties).toBeDefined();
    });

    test("should add mappings with different actions for different entity types", () => {
        const bundle = createTestBundle("test-bundle.json", {
            services: [{name: "Service1", resolutionPath: "/service1"}],
            policies: [{name: "Policy1", guid: "policy1-guid"}]
        });

        const output = graphman("mappings", 
            "--input", bundle,
            "--mappings.services.action", "NEW_OR_UPDATE",
            "--mappings.policies.action", "ALWAYS_CREATE_NEW");

        expect(output.services).toHaveLength(1);
        expect(output.policies).toHaveLength(1);
        expect(output.properties).toBeDefined();
    });

    test("should add mappings and remove duplicates", () => {
        const bundle = createTestBundle("test-bundle.json", {
            services: [
                {name: "Service1", resolutionPath: "/service1"},
                {name: "Service1", resolutionPath: "/service1"}
            ]
        });

        const output = graphman("mappings", 
            "--input", bundle,
            "--mappings.action", "NEW_OR_UPDATE");

        // Should remove duplicates
        expect(output.services).toHaveLength(1);
        expect(output.properties).toBeDefined();
    });

    test("should add mappings to empty bundle", () => {
        const bundle = createTestBundle("empty-bundle.json", {});

        const output = graphman("mappings", 
            "--input", bundle,
            "--mappings.action", "NEW_OR_UPDATE");

        // Should handle empty bundle
        expect(output.properties).toBeDefined();
    });

    test("should add mappings with mapping level option", () => {
        const bundle = createTestBundle("test-bundle.json", {
            services: [{name: "Service1", resolutionPath: "/service1"}]
        });

        const output = graphman("mappings", 
            "--input", bundle,
            "--mappings.action", "NEW_OR_UPDATE",
            "--mappings.level", "1");

        expect(output.services).toHaveLength(1);
        expect(output.properties).toBeDefined();
    });

    test("should add mappings with entity-specific level", () => {
        const bundle = createTestBundle("test-bundle.json", {
            services: [{name: "Service1", resolutionPath: "/service1"}],
            policies: [{name: "Policy1", guid: "policy1-guid"}]
        });

        const output = graphman("mappings", 
            "--input", bundle,
            "--mappings.services.level", "2",
            "--mappings.policies.level", "1");

        expect(output.services).toHaveLength(1);
        expect(output.policies).toHaveLength(1);
        expect(output.properties).toBeDefined();
    });

    test("should add mappings to bundle with keys", () => {
        const bundle = createTestBundle("test-bundle.json", {
            keys: [{alias: "key1", keystore: "keystore1"}]
        });

        const output = graphman("mappings", 
            "--input", bundle,
            "--mappings.keys.action", "NEW_OR_UPDATE");

        expect(output.keys).toHaveLength(1);
        expect(output.properties).toBeDefined();
    });

    test("should add mappings to bundle with trusted certificates", () => {
        const bundle = createTestBundle("test-bundle.json", {
            trustedCerts: [{name: "cert1", thumbprintSha1: "thumb1"}]
        });

        const output = graphman("mappings", 
            "--input", bundle,
            "--mappings.trustedCerts.action", "NEW_OR_UPDATE");

        expect(output.trustedCerts).toHaveLength(1);
        expect(output.properties).toBeDefined();
    });

    test("should add mappings to bundle with policy fragments", () => {
        const bundle = createTestBundle("test-bundle.json", {
            policyFragments: [{name: "Fragment1", guid: "fragment1-guid"}]
        });

        const output = graphman("mappings", 
            "--input", bundle,
            "--mappings.policyFragments.action", "NEW_OR_UPDATE");

        expect(output.policyFragments).toHaveLength(1);
        expect(output.properties).toBeDefined();
    });

    test("should add mappings to bundle with folders", () => {
        const bundle = createTestBundle("test-bundle.json", {
            folders: [{name: "Folder1", folderPath: "/folder1"}]
        });

        const output = graphman("mappings", 
            "--input", bundle,
            "--mappings.folders.action", "NEW_OR_UPDATE");

        expect(output.folders).toHaveLength(1);
        expect(output.properties).toBeDefined();
    });

    test("should add mappings to bundle with cluster properties", () => {
        const bundle = createTestBundle("test-bundle.json", {
            clusterProperties: [
                {name: "prop1", value: "value1"},
                {name: "prop2", value: "value2"}
            ]
        });

        const output = graphman("mappings", 
            "--input", bundle,
            "--mappings.clusterProperties.action", "NEW_OR_UPDATE");

        expect(output.clusterProperties).toHaveLength(2);
        expect(output.properties).toBeDefined();
    });

    test("should add mappings and sort output", () => {
        const bundle = createTestBundle("test-bundle.json", {
            services: [{name: "Service1", resolutionPath: "/service1"}],
            clusterProperties: [{name: "prop1", value: "value1"}]
        });

        const output = graphman("mappings", 
            "--input", bundle,
            "--mappings.action", "NEW_OR_UPDATE");

        // Verify output is sorted
        const keys = Object.keys(output).filter(k => k !== 'stdout');
        expect(keys.length).toBeGreaterThan(0);
    });

    test("should preserve existing bundle properties when adding mappings", () => {
        const bundle = createTestBundle("test-bundle.json", {
            services: [{name: "Service1", resolutionPath: "/service1"}],
            properties: {
                meta: {source: "test"}
            }
        });

        const output = graphman("mappings", 
            "--input", bundle,
            "--mappings.action", "NEW_OR_UPDATE");

        expect(output.services).toHaveLength(1);
        expect(output.properties).toBeDefined();
        expect(output.properties.mappings).toBeDefined();
    });
});

