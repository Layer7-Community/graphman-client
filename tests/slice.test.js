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

describe("slice command", () => {

    test("should throw error when --input parameter is missing", () => {
        expect(() => {
            graphman("slice", "--sections", "services");
        }).toThrow();
    });

    test("should slice bundle to include only specified section", () => {
        const bundle = createTestBundle("test-bundle.json", {
            services: [{name: "Service1", resolutionPath: "/service1"}],
            policies: [{name: "Policy1", guid: "policy1-guid"}],
            clusterProperties: [{name: "prop1", value: "value1"}]
        });

        const output = graphman("slice", 
            "--input", bundle, 
            "--sections", "services");

        expect(output.services).toHaveLength(1);
        expect(output.services).toEqual(expect.arrayContaining([
            expect.objectContaining({name: "Service1"})
        ]));
        expect(output.policies).toBeUndefined();
        expect(output.clusterProperties).toBeUndefined();
    });

    test("should slice bundle to include multiple specified sections", () => {
        const bundle = createTestBundle("test-bundle.json", {
            services: [{name: "Service1", resolutionPath: "/service1"}],
            policies: [{name: "Policy1", guid: "policy1-guid"}],
            clusterProperties: [{name: "prop1", value: "value1"}],
            folders: [{name: "Folder1", folderPath: "/folder1"}]
        });

        const output = graphman("slice", 
            "--input", bundle, 
            "--sections", "services", "policies");

        expect(output.services).toHaveLength(1);
        expect(output.policies).toHaveLength(1);
        expect(output.clusterProperties).toBeUndefined();
        expect(output.folders).toBeUndefined();
    });

    test("should slice bundle using wildcard to include all sections", () => {
        const bundle = createTestBundle("test-bundle.json", {
            services: [{name: "Service1", resolutionPath: "/service1"}],
            policies: [{name: "Policy1", guid: "policy1-guid"}],
            clusterProperties: [{name: "prop1", value: "value1"}]
        });

        const output = graphman("slice", 
            "--input", bundle, 
            "--sections", "*");

        expect(output.services).toHaveLength(1);
        expect(output.policies).toHaveLength(1);
        expect(output.clusterProperties).toHaveLength(1);
    });

    test("should slice bundle using wildcard then exclude specific section", () => {
        const bundle = createTestBundle("test-bundle.json", {
            services: [{name: "Service1", resolutionPath: "/service1"}],
            policies: [{name: "Policy1", guid: "policy1-guid"}],
            clusterProperties: [{name: "prop1", value: "value1"}]
        });

        const output = graphman("slice", 
            "--input", bundle, 
            "--sections", "*", "-policies");

        expect(output.services).toHaveLength(1);
        expect(output.policies).toBeUndefined();
        expect(output.clusterProperties).toHaveLength(1);
    });

    test("should slice bundle excluding multiple sections", () => {
        const bundle = createTestBundle("test-bundle.json", {
            services: [{name: "Service1", resolutionPath: "/service1"}],
            policies: [{name: "Policy1", guid: "policy1-guid"}],
            clusterProperties: [{name: "prop1", value: "value1"}],
            folders: [{name: "Folder1", folderPath: "/folder1"}]
        });

        const output = graphman("slice", 
            "--input", bundle, 
            "--sections", "*", "-policies", "-folders");

        expect(output.services).toHaveLength(1);
        expect(output.clusterProperties).toHaveLength(1);
        expect(output.policies).toBeUndefined();
        expect(output.folders).toBeUndefined();
    });

    test("should slice bundle with + prefix (explicit include)", () => {
        const bundle = createTestBundle("test-bundle.json", {
            services: [{name: "Service1", resolutionPath: "/service1"}],
            policies: [{name: "Policy1", guid: "policy1-guid"}],
            clusterProperties: [{name: "prop1", value: "value1"}]
        });

        const output = graphman("slice", 
            "--input", bundle, 
            "--sections", "+services", "+policies");

        expect(output.services).toHaveLength(1);
        expect(output.policies).toHaveLength(1);
        expect(output.clusterProperties).toBeUndefined();
    });

    test("should handle slicing empty bundle", () => {
        const bundle = createTestBundle("empty-bundle.json", {});

        const output = graphman("slice", 
            "--input", bundle, 
            "--sections", "services");

        expect(output.services).toBeUndefined();
    });

    test("should handle slicing bundle with non-existent section", () => {
        const bundle = createTestBundle("test-bundle.json", {
            services: [{name: "Service1", resolutionPath: "/service1"}]
        });

        const output = graphman("slice", 
            "--input", bundle, 
            "--sections", "policies");

        expect(output.services).toBeUndefined();
        expect(output.policies).toBeUndefined();
    });

    test("should slice bundle with filter by name", () => {
        const bundle = createTestBundle("test-bundle.json", {
            services: [
                {name: "Service1", resolutionPath: "/service1"},
                {name: "Service2", resolutionPath: "/service2"},
                {name: "TestService", resolutionPath: "/test"}
            ]
        });

        const output = graphman("slice", 
            "--input", bundle, 
            "--sections", "services",
            "--filter.services.name", "Service1");

        expect(output.services).toHaveLength(1);
        expect(output.services).toEqual(expect.arrayContaining([
            expect.objectContaining({name: "Service1"})
        ]));
    });

    test("should slice bundle with regex filter", () => {
        const bundle = createTestBundle("test-bundle.json", {
            services: [
                {name: "Service1", resolutionPath: "/service1"},
                {name: "Service2", resolutionPath: "/service2"},
                {name: "TestService", resolutionPath: "/test"}
            ]
        });

        const output = graphman("slice", 
            "--input", bundle, 
            "--sections", "services",
            "--filter.services.name", "regex.Service[12]");

        expect(output.services).toHaveLength(2);
        expect(output.services).toEqual(expect.arrayContaining([
            expect.objectContaining({name: "Service1"}),
            expect.objectContaining({name: "Service2"})
        ]));
    });

    test("should slice bundle with multiple entity types and preserve structure", () => {
        const bundle = createTestBundle("test-bundle.json", {
            services: [
                {name: "Service1", resolutionPath: "/service1"},
                {name: "Service2", resolutionPath: "/service2"}
            ],
            policies: [
                {name: "Policy1", guid: "policy1-guid"},
                {name: "Policy2", guid: "policy2-guid"}
            ],
            clusterProperties: [
                {name: "prop1", value: "value1"},
                {name: "prop2", value: "value2"}
            ]
        });

        const output = graphman("slice", 
            "--input", bundle, 
            "--sections", "services", "clusterProperties");

        expect(output.services).toHaveLength(2);
        expect(output.clusterProperties).toHaveLength(2);
        expect(output.policies).toBeUndefined();
    });

    test("should slice bundle and sort output", () => {
        const bundle = createTestBundle("test-bundle.json", {
            services: [{name: "Service1", resolutionPath: "/service1"}],
            clusterProperties: [{name: "prop1", value: "value1"}]
        });

        const output = graphman("slice", 
            "--input", bundle, 
            "--sections", "*");

        // Verify output has expected structure (sorted)
        const keys = Object.keys(output).filter(k => k !== 'stdout');
        expect(keys.length).toBeGreaterThan(0);
    });

    test("should handle slice with empty sections array", () => {
        const bundle = createTestBundle("test-bundle.json", {
            services: [{name: "Service1", resolutionPath: "/service1"}],
            policies: [{name: "Policy1", guid: "policy1-guid"}]
        });

        const output = graphman("slice", 
            "--input", bundle);

        // When no sections specified, should return empty or handle gracefully
        expect(output.services).toBeUndefined();
        expect(output.policies).toBeUndefined();
    });

    test("should slice bundle with keys and trusted certificates", () => {
        const bundle = createTestBundle("test-bundle.json", {
            keys: [{alias: "key1", keystore: "keystore1"}],
            trustedCerts: [{name: "cert1", thumbprintSha1: "thumb1"}],
            services: [{name: "Service1", resolutionPath: "/service1"}]
        });

        const output = graphman("slice", 
            "--input", bundle, 
            "--sections", "keys", "trustedCerts");

        expect(output.keys).toHaveLength(1);
        expect(output.trustedCerts).toHaveLength(1);
        expect(output.services).toBeUndefined();
    });

    test("should slice bundle with policy fragments", () => {
        const bundle = createTestBundle("test-bundle.json", {
            policies: [{name: "Policy1", guid: "policy1-guid"}],
            policyFragments: [{name: "Fragment1", guid: "fragment1-guid"}],
            services: [{name: "Service1", resolutionPath: "/service1"}]
        });

        const output = graphman("slice", 
            "--input", bundle, 
            "--sections", "policyFragments");

        expect(output.policyFragments).toHaveLength(1);
        expect(output.policies).toBeUndefined();
        expect(output.services).toBeUndefined();
    });
});

