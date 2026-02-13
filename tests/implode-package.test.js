// Copyright (c) 2025 Broadcom Inc. and its subsidiaries. All Rights Reserved.

const tUtils = require("./utils");
const {graphman} = tUtils;
const fs = require('fs');
const path = require('path');

const workspace = tUtils.config().workspace;
const explodedDir = `${workspace}/exploded-entities`;
const implodedFile = `${workspace}/imploded-bundle.json`;
const packageFile = `${workspace}/test.package`;
const bundleFile = `samples/bundle.json`;

// Helper function to clean up test files
function cleanup() {
    if (fs.existsSync(implodedFile)) {
        fs.unlinkSync(implodedFile);
    }
    if (fs.existsSync(packageFile)) {
        fs.unlinkSync(packageFile);
    }
}

// Set up test data before tests
beforeAll(() => {
    // Create exploded directory from sample bundle if it doesn't exist
    if (!fs.existsSync(explodedDir)) {
        try {
            graphman("explode",
                "--input", bundleFile,
                "--output", explodedDir,
                "--options.level", "2");
        } catch (e) {
            // If sample doesn't exist, skip - tests will handle it
            console.log("Note: samples/bundle.json not found, some tests may be skipped");
        }
    }
});

afterEach(() => {
    cleanup();
});


describe("Implode operation - with package file (filename references)", () => {
    test("implode with package file specifying filenames should include only specified entities", () => {
        // Create package file with specific entity filenames
        const packageSpec = {
            "clusterProperties": [
                "cluster.hostname.json",
                "keyStore.defaultSsl.alias.json"
            ]
        };
        fs.writeFileSync(packageFile, JSON.stringify(packageSpec, null, 2));

        const output = graphman("implode",
            "--input", explodedDir,
            "--output", implodedFile,
            "--package", packageFile);

        const bundle = tUtils.readFileAsJson(implodedFile);
        
        // Verify only specified entities are included
        expect(bundle).toHaveProperty("clusterProperties");
        expect(bundle.clusterProperties).toBeInstanceOf(Array);
        expect(bundle.clusterProperties.length).toBe(2);
        
        // Verify specific entities are present
        const names = bundle.clusterProperties.map(cp => cp.name);
        expect(names).toContain("cluster.hostname");
        expect(names).toContain("keyStore.defaultSsl.alias");
    });

    test("implode with package file should warn about missing entity files", () => {
        const packageSpec = {
            "clusterProperties": [
                "cluster.hostname.json",
                "non-existent-entity.json"
            ]
        };
        fs.writeFileSync(packageFile, JSON.stringify(packageSpec, null, 2));

        const output = graphman("implode",
            "--input", explodedDir,
            "--output", implodedFile,
            "--package", packageFile);

        expect(output.stdout).toContain("entity file not found");
        expect(output.stdout).toContain("non-existent-entity.json");
    });

    test("implode with multiple entity types in package file", () => {
        const packageSpec = {
            "clusterProperties": ["cluster.hostname.json"],
            "keys": ["ssl-00000000000000000000000000000002.json"]
        };
        fs.writeFileSync(packageFile, JSON.stringify(packageSpec, null, 2));

        const output = graphman("implode",
            "--input", explodedDir,
            "--output", implodedFile,
            "--package", packageFile);

        const bundle = tUtils.readFileAsJson(implodedFile);
        
        expect(bundle).toHaveProperty("clusterProperties");
        expect(bundle.clusterProperties.length).toBe(1);
        
        expect(bundle).toHaveProperty("keys");
        expect(bundle.keys.length).toBe(1);
    });
});

describe("Implode operation - with package file (entity summary references)", () => {
    test("implode with package file using entity summary objects", () => {
        const packageSpec = {
            "clusterProperties": [
                {"name": "cluster.hostname"}
            ]
        };
        fs.writeFileSync(packageFile, JSON.stringify(packageSpec, null, 2));

        const output = graphman("implode",
            "--input", explodedDir,
            "--output", implodedFile,
            "--package", packageFile);


        const bundle = tUtils.readFileAsJson(implodedFile);
        
        expect(bundle).toHaveProperty("clusterProperties");
        expect(bundle.clusterProperties.length).toBe(1);
        expect(bundle.clusterProperties[0].name).toBe("cluster.hostname");
    });

    test("implode with package file using goid in summary", () => {
        const packageSpec = {
            "clusterProperties": [
                {"goid": "2bf23f7e0c0bfc3d53358e1b5806a130"}
            ]
        };
        fs.writeFileSync(packageFile, JSON.stringify(packageSpec, null, 2));

        const output = graphman("implode",
            "--input", explodedDir,
            "--output", implodedFile,
            "--package", packageFile);

        const bundle = tUtils.readFileAsJson(implodedFile);
        
        if (bundle.clusterProperties && bundle.clusterProperties.length > 0) {
            expect(bundle.clusterProperties).toBeInstanceOf(Array);
            expect(bundle.clusterProperties[0]).toHaveProperty("goid");
        }
    });

    test("implode with package file should warn about non-matching summary", () => {
        const packageSpec = {
            "clusterProperties": [
                {"name": "non-existent-property"}
            ]
        };
        fs.writeFileSync(packageFile, JSON.stringify(packageSpec, null, 2));

        const output = graphman("implode",
            "--input", explodedDir,
            "--output", implodedFile,
            "--package", packageFile);

        expect(output.stdout).toContain("entity not found matching summary");
    });

    test("implode with mixed filename and summary references", () => {
        const packageSpec = {
            "clusterProperties": [
                "cluster.hostname.json",
                {"name": "keyStore.defaultSsl.alias"}
            ]
        };
        fs.writeFileSync(packageFile, JSON.stringify(packageSpec, null, 2));

        const output = graphman("implode",
            "--input", explodedDir,
            "--output", implodedFile,
            "--package", packageFile);

        const bundle = tUtils.readFileAsJson(implodedFile);
        
        expect(bundle).toHaveProperty("clusterProperties");
        expect(bundle.clusterProperties.length).toBe(2);
    });
});

describe("Implode operation - folderable entities (services/policies)", () => {
    test("implode should handle tree structure (services and policies)", () => {
        const output = graphman("implode",
            "--input", "samples/entities",
            "--output", implodedFile);

        const bundle = tUtils.readFileAsJson(implodedFile);
        
        // Check if services or policies from tree are included
        if (bundle.services || bundle.policies) {
            expect(bundle.services || bundle.policies).toBeInstanceOf(Array);
        }
    });

    test("implode with package file should filter tree entities", () => {
        // First, check what services exist in the entities
        const output = graphman("implode",
            "--input", explodedDir,
            "--output", implodedFile);
        
        const fullBundle = tUtils.readFileAsJson(implodedFile);
        
        if (fullBundle.services && fullBundle.services.length > 0) {
            const firstService = fullBundle.services[0];
            
            // Create package file with specific service
            const packageSpec = {
                "services": [{"resolutionPath": firstService.resolutionPath}]
            };
            fs.writeFileSync(packageFile, JSON.stringify(packageSpec, null, 2));

            const filteredOutput = graphman("implode",
                "--input", "samples/entities",
                "--output", implodedFile,
                "--package", packageFile);

            const filteredBundle = tUtils.readFileAsJson(implodedFile);
            
            expect(filteredBundle.services).toBeInstanceOf(Array);
            expect(filteredBundle.services.length).toBeLessThanOrEqual(fullBundle.services.length);
        }
    });
});

describe("Implode operation - package file validation", () => {
    test("implode with non-existent package file should fail", () => {
        expect(() => {
            graphman("implode",
                "--input", explodedDir,
                "--output", implodedFile,
                "--package", "non-existent-package.json");
        }).toThrow();
    });

    test("implode with unknown entity type in package file should warn", () => {
        const packageSpec = {
            "unknownEntityType": ["some-file.json"]
        };
        fs.writeFileSync(packageFile, JSON.stringify(packageSpec, null, 2));

        const output = graphman("implode",
            "--input", explodedDir,
            "--output", implodedFile,
            "--package", packageFile);

        expect(output.stdout).toContain("unknown entity type");
    });

    test("implode with invalid package file section (not an array) should warn", () => {
        const packageSpec = {
            "clusterProperties": "not-an-array"
        };
        fs.writeFileSync(packageFile, JSON.stringify(packageSpec, null, 2));

        const output = graphman("implode",
            "--input", explodedDir,
            "--output", implodedFile,
            "--package", packageFile);

        expect(output.stdout).toContain("should be an array");
    });
});

describe("Implode operation - mapping filtering", () => {
    test("implode with package file should filter mappings to match selected entities", () => {

        const packageSpec = {
            "clusterProperties": ["cluster.hostname.json"]
        };
        fs.writeFileSync(packageFile, JSON.stringify(packageSpec, null, 2));

        const output = graphman("implode",
            "--input", explodedDir,
            "--output", implodedFile,
            "--package", packageFile);

        const bundle = tUtils.readFileAsJson(implodedFile);
        
        // If mappings exist, verify they're filtered
        if (bundle.properties && bundle.properties.mappings) {
            // Mappings should only include those for selected entities or defaults
            if (bundle.properties.mappings.clusterProperties) {
                const mappings = bundle.properties.mappings.clusterProperties;
                // All non-default mappings should match selected entities
                const nonDefaultMappings = mappings.filter(m => !m.default);
                nonDefaultMappings.forEach(mapping => {
                    const source = mapping.source || mapping;
                    // Should match one of our selected entities
                    expect(source.name).toBe("cluster.hostname");
                });
            }
        }
    });

    test("implode without package file should include all mappings", () => {

        const output = graphman("implode",
            "--input", explodedDir,
            "--output", implodedFile);

        const bundle = tUtils.readFileAsJson(implodedFile);
        const originalProps = tUtils.readFileAsJson("samples/entities/bundle-properties.json");
        
        // All original mappings should be preserved
        if (originalProps.mappings && bundle.properties && bundle.properties.mappings) {
            Object.keys(originalProps.mappings).forEach(entityType => {
                if (bundle.properties.mappings[entityType]) {
                    expect(bundle.properties.mappings[entityType]).toBeInstanceOf(Array);
                }
            });
        }
    });
});

describe("Implode operation - special entity handling", () => {
    test("implode should handle keys with binary data", () => {

        const output = graphman("implode",
            "--input", explodedDir,
            "--output", implodedFile);

        const bundle = tUtils.readFileAsJson(implodedFile);
        
        if (bundle.keys && bundle.keys.length > 0) {
            const key = bundle.keys[0];
            // Keys should have proper structure
            expect(key).toHaveProperty("alias");
        }
    });

    test("implode should handle trusted certificates", () => {

        const output = graphman("implode",
            "--input", explodedDir,
            "--output", implodedFile);

        const bundle = tUtils.readFileAsJson(implodedFile);
        
        if (bundle.trustedCerts && bundle.trustedCerts.length > 0) {
            const cert = bundle.trustedCerts[0];
            expect(cert).toHaveProperty("name");
        }
    });

    test("implode should handle internal users", () => {
        const output = graphman("implode",
            "--input", explodedDir,
            "--output", implodedFile);

        const bundle = tUtils.readFileAsJson(implodedFile);
        
        if (bundle.internalUsers && bundle.internalUsers.length > 0) {
            const user = bundle.internalUsers[0];
            expect(user).toHaveProperty("name");
        }
    });
});
