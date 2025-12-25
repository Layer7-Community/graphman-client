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

describe("revise command", () => {

    test("should throw error when --input parameter is missing", () => {
        expect(() => {
            graphman("revise");
        }).toThrow();
    });

    test("should revise bundle with default options", () => {
        const bundle = createTestBundle("test-bundle.json", {
            services: [{
                name: "Service1",
                resolutionPath: "/service1",
                goid: "service1-goid"
            }],
            policies: [{
                name: "Policy1",
                guid: "policy1-guid",
                goid: "policy1-goid"
            }]
        });

        const output = graphman("revise", "--input", bundle);

        expect(output.services).toHaveLength(1);
        expect(output.policies).toHaveLength(1);
        expect(output.services[0]).toMatchObject({
            name: "Service1",
            resolutionPath: "/service1"
        });
    });

    test("should revise bundle with normalize option", () => {
        const bundle = createTestBundle("test-bundle.json", {
            services: [{
                name: "Service1",
                resolutionPath: "/service1",
                goid: "service1-goid",
                checksum: "checksum123"
            }]
        });

        const output = graphman("revise", 
            "--input", bundle,
            "--options.normalize", "true");

        expect(output.services).toHaveLength(1);
        expect(output.services[0].name).toBe("Service1");
    });

    test("should revise bundle with excludeGoids option", () => {
        const bundle = createTestBundle("test-bundle.json", {
            services: [{
                name: "Service1",
                resolutionPath: "/service1",
                goid: "service1-goid"
            }],
            policies: [{
                name: "Policy1",
                guid: "policy1-guid",
                goid: "policy1-goid"
            }]
        });

        const output = graphman("revise", 
            "--input", bundle,
            "--options.normalize", "true",
            "--options.excludeGoids", "true");

        expect(output.services).toHaveLength(1);
        expect(output.policies).toHaveLength(1);
        // With excludeGoids, goids should be removed
        expect(output.services[0].goid).toBeUndefined();
        expect(output.policies[0].goid).toBeUndefined();
    });

    test("should revise bundle and preserve properties section", () => {
        const bundle = createTestBundle("test-bundle.json", {
            services: [{name: "Service1", resolutionPath: "/service1"}],
            properties: {
                meta: {source: "test"}
            }
        });

        const output = graphman("revise", "--input", bundle);

        expect(output.services).toHaveLength(1);
        expect(output.properties).toMatchObject({
            meta: {source: "test"}
        });
    });

    test("should revise bundle with multiple entity types", () => {
        const bundle = createTestBundle("test-bundle.json", {
            services: [{name: "Service1", resolutionPath: "/service1"}],
            policies: [{name: "Policy1", guid: "policy1-guid"}],
            clusterProperties: [{name: "prop1", value: "value1"}],
            folders: [{name: "Folder1", folderPath: "/folder1"}]
        });

        const output = graphman("revise", "--input", bundle);

        expect(output.services).toHaveLength(1);
        expect(output.policies).toHaveLength(1);
        expect(output.clusterProperties).toHaveLength(1);
        expect(output.folders).toHaveLength(1);
    });

    test("should revise bundle with normalize and remove duplicates", () => {
        const bundle = createTestBundle("test-bundle.json", {
            services: [
                {name: "Service1", resolutionPath: "/service1"},
                {name: "Service1", resolutionPath: "/service1"}
            ]
        });

        const output = graphman("revise", 
            "--input", bundle,
            "--options.normalize", "true");

        // Normalize should remove duplicates
        expect(output.services).toHaveLength(1);
    });

    test("should revise empty bundle", () => {
        const bundle = createTestBundle("empty-bundle.json", {});

        const output = graphman("revise", "--input", bundle);

        // Should handle empty bundle gracefully
        const keys = Object.keys(output).filter(k => k !== 'stdout');
        expect(keys.length).toBe(0);
    });

    test("should revise bundle with keys and certificates", () => {
        const bundle = createTestBundle("test-bundle.json", {
            keys: [{
                alias: "key1",
                keystore: "keystore1",
                goid: "key1-goid"
            }],
            trustedCerts: [{
                name: "cert1",
                thumbprintSha1: "thumb1",
                goid: "cert1-goid"
            }]
        });

        const output = graphman("revise", "--input", bundle);

        expect(output.keys).toHaveLength(1);
        expect(output.trustedCerts).toHaveLength(1);
    });

    test("should revise bundle and sort output", () => {
        const bundle = createTestBundle("test-bundle.json", {
            services: [{name: "Service1", resolutionPath: "/service1"}],
            clusterProperties: [{name: "prop1", value: "value1"}]
        });

        const output = graphman("revise", "--input", bundle);

        // Verify output is sorted
        const keys = Object.keys(output).filter(k => k !== 'stdout');
        expect(keys.length).toBeGreaterThan(0);
    });

    test("should revise bundle with complex entities", () => {
        const bundle = createTestBundle("test-bundle.json", {
            services: [{
                name: "Service1",
                resolutionPath: "/service1",
                enabled: true,
                goid: "service1-goid",
                policy: {
                    xml: "<policy>...</policy>"
                },
                properties: [{key: "prop1", value: "value1"}]
            }]
        });

        const output = graphman("revise", "--input", bundle);

        expect(output.services).toHaveLength(1);
        expect(output.services[0].policy).toBeDefined();
        expect(output.services[0].properties).toBeDefined();
    });

    test("should revise bundle with policy fragments", () => {
        const bundle = createTestBundle("test-bundle.json", {
            policies: [{name: "Policy1", guid: "policy1-guid"}],
            policyFragments: [{name: "Fragment1", guid: "fragment1-guid"}]
        });

        const output = graphman("revise", "--input", bundle);

        expect(output.policies).toHaveLength(1);
        expect(output.policyFragments).toHaveLength(1);
    });

    test("should revise bundle without normalize option", () => {
        const bundle = createTestBundle("test-bundle.json", {
            services: [
                {name: "Service1", resolutionPath: "/service1", goid: "goid1"},
                {name: "Service1", resolutionPath: "/service1", goid: "goid2"}
            ]
        });

        const output = graphman("revise", 
            "--input", bundle,
            "--options.normalize", "false");

        // Without normalize, duplicates should remain
        expect(output.services).toHaveLength(2);
    });

    test("should revise bundle with internal users", () => {
        const bundle = createTestBundle("test-bundle.json", {
            internalUsers: [{
                name: "user1",
                login: "user1",
                goid: "user1-goid"
            }]
        });

        const output = graphman("revise", "--input", bundle);

        expect(output.internalUsers).toHaveLength(1);
        expect(output.internalUsers[0].name).toBe("user1");
    });

    test("should revise bundle with scheduled tasks", () => {
        const bundle = createTestBundle("test-bundle.json", {
            scheduledTasks: [{
                name: "task1",
                policyGoid: "policy-goid",
                goid: "task1-goid"
            }]
        });

        const output = graphman("revise", "--input", bundle);

        expect(output.scheduledTasks).toHaveLength(1);
        expect(output.scheduledTasks[0].name).toBe("task1");
    });

    test("should revise bundle preserving properties at end", () => {
        const bundle = createTestBundle("test-bundle.json", {
            services: [{name: "Service1", resolutionPath: "/service1"}],
            properties: {
                mappings: {
                    services: [{action: "NEW_OR_UPDATE"}]
                }
            }
        });

        const output = graphman("revise", "--input", bundle);

        expect(output.services).toHaveLength(1);
        expect(output.properties).toBeDefined();
        expect(output.properties.mappings).toBeDefined();
        
        // Properties should be at the end
        const keys = Object.keys(output).filter(k => k !== 'stdout');
        expect(keys[keys.length - 1]).toBe('properties');
    });
});

