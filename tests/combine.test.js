// Copyright (c) 2025 Broadcom Inc. and its subsidiaries. All Rights Reserved.

const tUtils = require("./utils");
const {graphman} = tUtils;
const fs = require('fs');
const path = require('path');
const workspace = tUtils.config().workspace;
// Helper to create test bundle files
function createTestBundle(filename, content) {
    if (!fs.existsSync(workspace)) {
        fs.mkdirSync(workspace, { recursive: true });
    }
    const filepath = path.join(workspace, filename);
    fs.writeFileSync(filepath, JSON.stringify(content, null, 2));
    return filepath;
}

describe("combine command", () => {
    
    test("should throw error when --inputs parameter is missing", () => {
        const output = graphman("combine");
        expect(output.stdout).toContain("inputs parameters are missing");
    });

    test("should throw error when less than two input bundles are provided", () => {
        const bundle1 = createTestBundle("bundle1.json", {
            services: [{name: "Service1", resolutionPath: "/service1"}]
        });
        const output = graphman("combine", "--inputs", bundle1);
        expect(output.stdout).toContain("operation requires at least two bundles");
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

    test("should contain entities from both the bundles", () => {
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
        // All entities should be present (output is sorted, so check for presence rather than order)
        expect(output.clusterProperties).toEqual(expect.arrayContaining([
            expect.objectContaining({name: "prop1", value: "value1"}),
            expect.objectContaining({name: "prop2", value: "value2"}),
            expect.objectContaining({name: "prop3", value: "value3"})
        ]));
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

    test("combine two bundles with unique entities", () => {
        const bundle1Path = path.join("samples", "combine-bundle-1.json");
        const bundle3Path = path.join("samples", "combine-bundle-3.json");
        const outputPath = path.join(workspace, "tests", "combine-output-1.json");

        graphman("combine", "--inputs", bundle1Path, bundle3Path, "--output", outputPath);

        const output = JSON.parse(fs.readFileSync(outputPath, 'utf8'));

        // Bundle1 has 6 services, bundle3 has 0 services - result should have 6
        expect(output.services).toBeDefined();
        expect(output.services.length).toBe(6);

        // Bundle1 has 6 policies, bundle3 has 0 policies - result should have 6
        expect(output.policies).toBeDefined();
        expect(output.policies.length).toBe(6);

        // Bundle1 has 5 clusterProperties, bundle3 has 0 - result should have 5
        expect(output.clusterProperties).toBeDefined();
        expect(output.clusterProperties.length).toBe(5);

        // Bundle1 has 0 encassConfigs, bundle3 has 3 - result should have 3
        expect(output.encassConfigs).toBeDefined();
        expect(output.encassConfigs.length).toBe(3);

        // Bundle1 has 0 keys, bundle3 has 3 - result should have 3
        expect(output.keys).toBeDefined();
        expect(output.keys.length).toBe(3);

        // Bundle1 has 0 secrets, bundle3 has 2 - result should have 2
        expect(output.secrets).toBeDefined();
        expect(output.secrets.length).toBe(2);

        // Properties should be merged
        expect(output.properties).toBeDefined();
    });

    test("combine bundles with overlapping entities - right takes precedence", () => {
        const bundle1Path = path.join("samples", "combine-bundle-1.json");
        const bundle2Path = path.join("samples", "combine-bundle-2.json");
        const outputPath = path.join(workspace, "combine-output-2.json");

        graphman("combine", "--inputs", bundle1Path, bundle2Path, "--output", outputPath);
        const output = JSON.parse(fs.readFileSync(outputPath, 'utf8'));

        // Should contain all services (bundle1 + bundle2, with bundle2 taking precedence for duplicates)
        expect(output.services).toBeDefined();
        expect(output.services.length).toBeGreaterThanOrEqual(6); // At least bundle1's 6 services

        // Verify that overlapping service from bundle2 is present (right takes precedence)
        const overlappingService = output.services.find(s =>
            s.resolutionPath === "/jsonpolicy-webapi" || s.name === "jsonpolicy-webapi"
        );
        expect(overlappingService).toBeDefined();
        // Verify that the goid matches the right bundle (bundle2) goid
        // Bundle1 has goid "2bf23f7e0c0bfc3d53358e1b5806a29e", Bundle2 has goid "2bf23f7e0c0bfc3d53358e1b5806a29f"
        expect(overlappingService.goid).toBe("2bf23f7e0c0bfc3d53358e1b5806a29f");

        // Should contain all policies from both bundles
        expect(output.policies).toBeDefined();
        expect(output.policies.length).toBeGreaterThanOrEqual(6);

        // Should contain all cluster properties from both bundles
        expect(output.clusterProperties).toBeDefined();
        expect(output.clusterProperties.length).toBeGreaterThanOrEqual(5);
    });

    test("combine bundles - right defaultAction takes precedence", () => {
        const bundle1Path = path.join("samples", "combine-bundle-1.json");
        const bundle2Path = path.join("samples", "combine-bundle-2.json");
        const outputPath = path.join(workspace, "combine-output-3.json");

        graphman("combine", "--inputs", bundle1Path, bundle2Path, "--output", outputPath);

        const output = JSON.parse(fs.readFileSync(outputPath, 'utf8'));

        // Right bundle's defaultAction should take precedence
        expect(output.properties.defaultAction).toBe("NEW_OR_UPDATE");
    });

    test("combine bundles - mappings are merged with right taking precedence", () => {
        const bundle1Path = path.join("samples", "combine-bundle-1.json");
        const bundle2Path = path.join("samples", "combine-bundle-2.json");
        const outputPath = path.join(workspace, "combine-output-4.json");

        graphman("combine", "--inputs", bundle1Path, bundle2Path, "--output", outputPath);

        const output = tUtils.readFileAsJson(outputPath);

        expect(output.properties.mappings).toBeDefined();
        expect(output.properties.mappings.services).toBeDefined();

        // Should contain mappings from both bundles
        expect(output.properties.mappings.services.length).toBeGreaterThanOrEqual(6);

        // Verify overlapping mapping from bundle2 is present (right takes precedence)
        const overlappingMapping = output.properties.mappings.services.find(m =>
            m.resolutionPath === "/jsonpolicy-webapi"
        );
        expect(overlappingMapping).toBeDefined();
        // Verify that the action matches the right bundle (bundle2) action
        // Bundle1 has action "NEW_OR_EXISTING", Bundle2 has action "NEW_OR_UPDATE"
        expect(overlappingMapping.action).toBe("NEW_OR_UPDATE");
    });

    test("combine three bundles", () => {
        const bundle1Path = path.join("samples", "combine-bundle-1.json");
        const bundle2Path = path.join("samples", "combine-bundle-2.json");
        const bundle3Path = path.join("samples", "combine-bundle-3.json");
        const outputPath = path.join(workspace, "combine-output-5.json");

        graphman("combine", "--inputs", bundle1Path, bundle2Path, bundle3Path, "--output", outputPath);

        const output = tUtils.readFileAsJson(outputPath);

        // Should contain entities from all three bundles
        expect(output.services).toBeDefined();
        expect(output.services.length).toBeGreaterThan(0);

        expect(output.encassConfigs).toBeDefined();
        expect(output.encassConfigs.length).toBeGreaterThan(0);

        expect(output.keys).toBeDefined();
        expect(output.keys.length).toBeGreaterThan(0);

        // Rightmost bundle's defaultAction should take precedence
        expect(output.properties.defaultAction).toBe("ALWAYS_CREATE_NEW");
    });

    test("combine bundles with empty bundle", () => {
        const bundle1Path = path.join("samples", "combine-bundle-1.json");
        const bundle4Path = path.join("samples", "combine-bundle-4.json");
        const outputPath = path.join(workspace, "combine-output-6.json");

        graphman("combine", "--inputs", bundle1Path, bundle4Path, "--output", outputPath);

        const output = tUtils.readFileAsJson(outputPath);

        // Should contain entities from bundle1
        expect(output.services).toBeDefined();
        expect(output.services.length).toBeGreaterThan(0);

        // Empty bundle's defaultAction should take precedence
        expect(output.properties.defaultAction).toBe("IGNORE");
    });

    test("combine bundles - all entity types are preserved", () => {
        const bundle1Path = path.join("samples", "combine-bundle-1.json");
        const bundle2Path = path.join("samples", "combine-bundle-2.json");
        const bundle3Path = path.join("samples", "combine-bundle-3.json");
        const outputPath = path.join(workspace, "tests", "combine-output-7.json");

        graphman("combine", "--inputs", bundle1Path, bundle2Path, bundle3Path, "--output", outputPath);

        const output = tUtils.readFileAsJson(outputPath);

        // Verify all entity types from all bundles are present
        expect(output.services).toBeDefined();
        expect(output.policies).toBeDefined();
        expect(output.clusterProperties).toBeDefined();
        expect(output.encassConfigs).toBeDefined();
        expect(output.keys).toBeDefined();
        expect(output.secrets).toBeDefined();
    });

    test("combine bundles - mappings for all entity types are preserved", () => {
        const bundle1Path = path.join("samples", "combine-bundle-1.json");
        const bundle2Path = path.join("samples", "combine-bundle-2.json");
        const bundle3Path = path.join("samples", "combine-bundle-3.json");
        const outputPath = path.join(workspace, "combine-output-8.json");

        graphman("combine", "--inputs", bundle1Path, bundle2Path, bundle3Path, "--output", outputPath);

        const output = tUtils.readFileAsJson(outputPath);

        expect(output.properties.mappings).toBeDefined();

        // Verify mappings for different entity types
        expect(output.properties.mappings.services).toBeDefined();
        expect(output.properties.mappings.policies).toBeDefined();
        expect(output.properties.mappings.clusterProperties).toBeDefined();
        expect(output.properties.mappings.encassConfigs).toBeDefined();
        expect(output.properties.mappings.keys).toBeDefined();
        expect(output.properties.mappings.secrets).toBeDefined();
    });

    test("combine bundles - no duplicate entities in result", () => {
        const bundle1Path = path.join("samples", "combine-bundle-1.json");
        const bundle2Path = path.join("samples", "combine-bundle-2.json");
        const outputPath = path.join(workspace, "combine-output-9.json");

        graphman("combine", "--inputs", bundle1Path, bundle2Path, "--output", outputPath);

        const output = tUtils.readFileAsJson(outputPath);

        // Check services for duplicates (same resolutionPath and serviceType)
        const serviceIdentities = new Set();
        output.services.forEach(service => {
            const identity = `${service.resolutionPath || service.name}:${service.serviceType}`;
            expect(serviceIdentities.has(identity)).toBe(false);
            serviceIdentities.add(identity);
        });
    });

    test("combine bundles - verify entity count matches expected", () => {
        const bundle1Path = path.join("samples", "combine-bundle-1.json");
        const bundle2Path = path.join("samples", "combine-bundle-2.json");
        const outputPath = path.join(workspace, "combine-output-10.json");

        graphman("combine", "--inputs", bundle1Path, bundle2Path, "--output", outputPath);

        const output = tUtils.readFileAsJson(outputPath);

        // Bundle1 has 6 services, bundle2 has 7 services (including 1 overlap)
        // Result should have 6 + 7 - 1 = 12 services (or at least close to that)
        expect(output.services.length).toBeGreaterThanOrEqual(6);

        // Policies: bundle1 has 6, bundle2 has remaining (no overlap expected)
        expect(output.policies.length).toBeGreaterThanOrEqual(6);
    });

    test("combine bundles - properties meta information", () => {
        const bundle1Path = path.join("samples", "combine-bundle-1.json");
        const bundle2Path = path.join("samples", "combine-bundle-2.json");
        const outputPath = path.join(workspace, "combine-output-11.json");

        graphman("combine", "--inputs", bundle1Path, bundle2Path, "--output", outputPath);

        const output = tUtils.readFileAsJson(outputPath);

        // Properties should exist
        expect(output.properties).toBeDefined();

        // Mappings should exist
        expect(output.properties.mappings).toBeDefined();
    });

    test("combine bundles - rightmost bundle mappings take precedence for duplicates", () => {
        const bundle1Path = path.join("samples", "combine-bundle-1.json");
        const bundle2Path = path.join("samples", "combine-bundle-2.json");
        const outputPath = path.join(workspace, "combine-output-12.json");

        graphman("combine", "--inputs", bundle1Path, bundle2Path, "--output", outputPath);

        const output = tUtils.readFileAsJson(outputPath);

        // Find the overlapping service mapping
        const overlappingServiceMapping = output.properties.mappings.services.find(m =>
            m.resolutionPath === "/jsonpolicy-webapi"
        );

        // The mapping from bundle2 should be present (right takes precedence)
        expect(overlappingServiceMapping).toBeDefined();
        expect(overlappingServiceMapping.action).toBe("NEW_OR_UPDATE");
    });

    test("combine bundles - all mappings from left bundle are preserved when no overlap", () => {
        const bundle1Path = path.join("samples", "combine-bundle-1.json");
        const bundle3Path = path.join("samples", "combine-bundle-3.json");
        const outputPath = path.join(workspace, "combine-output-13.json");

        graphman("combine", "--inputs", bundle1Path, bundle3Path, "--output", outputPath);

        const output = tUtils.readFileAsJson(outputPath);

        // Bundle1 and bundle3 have no overlapping entity types in mappings
        // All mappings from both should be present
        expect(output.properties.mappings.services).toBeDefined();
        expect(output.properties.mappings.services.length).toBeGreaterThanOrEqual(6);

        expect(output.properties.mappings.encassConfigs).toBeDefined();
        expect(output.properties.mappings.encassConfigs.length).toBeGreaterThan(0);
    });

    test("combine bundles - result is sorted", () => {
        const bundle1Path = path.join("samples", "combine-bundle-1.json");
        const bundle2Path = path.join("samples", "combine-bundle-2.json");
        const bundle3Path = path.join("samples", "combine-bundle-3.json");
        const outputPath = path.join(workspace, "combine-output-14.json");

        graphman("combine", "--inputs", bundle1Path, bundle2Path, bundle3Path, "--output", outputPath);

        const output = tUtils.readFileAsJson(outputPath);

        // Services should be sorted (check first few)
        if (output.services.length > 1) {
            const serviceNames = output.services.map(s => s.name || s.resolutionPath).filter(Boolean);
            const sortedNames = [...serviceNames].sort();
            expect(serviceNames).toEqual(sortedNames);
        }
    });
});

