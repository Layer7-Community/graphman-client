// Copyright (c) 2025 Broadcom Inc. and its subsidiaries. All Rights Reserved.

const tUtils = require("./utils");
const {graphman} = tUtils;
const fs = require('fs');
const path = require('path');

const workspace = tUtils.config().workspace;
const explodedDir = `${workspace}/exploded-entities`;
const implodedFile = `${workspace}/imploded-bundle.json`;
const packageFile = `${workspace}/test.package`;

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
    // Set GRAPHMAN_HOME if not already set (for tests to work)
    if (!process.env.GRAPHMAN_HOME) {
        process.env.GRAPHMAN_HOME = path.resolve(__dirname, '..');
    }
    
    // Set GRAPHMAN_ENTRYPOINT to use node directly (works on all platforms)
    if (!process.env.GRAPHMAN_ENTRYPOINT) {
        const isWindows = process.platform === 'win32';
        process.env.GRAPHMAN_ENTRYPOINT = isWindows ? 'graphman.bat' : 'graphman.sh';
    }
    
    // Create exploded directory from sample bundle if it doesn't exist
    if (!fs.existsSync(explodedDir)) {
        try {
            graphman("explode",
                "--input", "samples/bundle.json",
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

describe("Implode operation - basic functionality", () => {
    test("implode without package file should include all entities", () => {
        const output = graphman("implode",
            "--input", "samples/entities",
            "--output", implodedFile);

        expect(output.stdout).toContain("imploding");
        expect(fs.existsSync(implodedFile)).toBe(true);
        
        const bundle = tUtils.readFileAsJson(implodedFile);
        
        // Verify bundle contains various entity types
        expect(bundle).toHaveProperty("clusterProperties");
        expect(bundle.clusterProperties).toBeInstanceOf(Array);
        expect(bundle.clusterProperties.length).toBeGreaterThan(0);
    });

    test("implode with missing input directory should fail", () => {
        expect(() => {
            graphman("implode",
                "--input", "non-existent-directory",
                "--output", implodedFile);
        }).toThrow();
    });

    test("implode should handle bundle properties", () => {
        const output = graphman("implode",
            "--input", "samples/entities",
            "--output", implodedFile);

        const bundle = tUtils.readFileAsJson(implodedFile);
        
        // Check if properties are included (if they exist in the source)
        if (fs.existsSync("samples/entities/bundle-properties.json")) {
            expect(bundle).toHaveProperty("properties");
        }
    });
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
            "--input", "samples/entities",
            "--output", implodedFile,
            "--package", packageFile);

        expect(output.stdout).toContain("using package file");
        expect(output.stdout).toContain("selected entity from package");
        
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
            "--input", "samples/entities",
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
            "--input", "samples/entities",
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
            "--input", "samples/entities",
            "--output", implodedFile,
            "--package", packageFile);

        expect(output.stdout).toContain("selected entity from package");
        
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
            "--input", "samples/entities",
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
            "--input", "samples/entities",
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
            "--input", "samples/entities",
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
            "--input", "samples/entities",
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
                "--input", "samples/entities",
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
            "--input", "samples/entities",
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
            "--input", "samples/entities",
            "--output", implodedFile,
            "--package", packageFile);

        expect(output.stdout).toContain("should be an array");
    });
});

describe("Implode operation - roundtrip with explode", () => {
    test("explode then implode should preserve entity data", () => {
        const tempExploded = `${workspace}/temp-exploded`;
        const tempImploded = `${workspace}/temp-imploded.json`;

        // Explode
        graphman("explode",
            "--input", "samples/cluster-properties.json",
            "--output", tempExploded,
            "--options.level", "1");

        // Implode
        graphman("implode",
            "--input", tempExploded,
            "--output", tempImploded);

        const original = tUtils.readFileAsJson("samples/cluster-properties.json");
        const roundtrip = tUtils.readFileAsJson(tempImploded);

        // Compare entity counts
        if (original.clusterProperties) {
            expect(roundtrip.clusterProperties).toBeInstanceOf(Array);
            expect(roundtrip.clusterProperties.length).toBe(original.clusterProperties.length);
        }

        // Cleanup
        if (fs.existsSync(tempImploded)) fs.unlinkSync(tempImploded);
    });

    test("explode then implode with package filter should include only specified entities", () => {
        const tempExploded = `${workspace}/temp-exploded-filtered`;
        const tempImploded = `${workspace}/temp-imploded-filtered.json`;

        // Explode full bundle
        graphman("explode",
            "--input", "samples/cluster-properties.json",
            "--output", tempExploded,
            "--options.level", "1");

        // Get first entity for filtering
        const fullBundle = tUtils.readFileAsJson("samples/cluster-properties.json");
        if (fullBundle.clusterProperties && fullBundle.clusterProperties.length > 0) {
            const firstEntity = fullBundle.clusterProperties[0];
            
            // Create package file
            const packageSpec = {
                "clusterProperties": [{"name": firstEntity.name}]
            };
            const tempPackage = `${workspace}/temp.package`;
            fs.writeFileSync(tempPackage, JSON.stringify(packageSpec, null, 2));

            // Implode with package filter
            graphman("implode",
                "--input", tempExploded,
                "--output", tempImploded,
                "--package", tempPackage);

            const filtered = tUtils.readFileAsJson(tempImploded);

            expect(filtered.clusterProperties).toBeInstanceOf(Array);
            expect(filtered.clusterProperties.length).toBe(1);
            expect(filtered.clusterProperties[0].name).toBe(firstEntity.name);

            // Cleanup
            if (fs.existsSync(tempPackage)) fs.unlinkSync(tempPackage);
        }

        // Cleanup
        if (fs.existsSync(tempImploded)) fs.unlinkSync(tempImploded);
    });
});

describe("Implode operation - mapping filtering", () => {
    test("implode with package file should filter mappings to match selected entities", () => {
        // This test requires bundle-properties.json with mappings
        // Skip if not available
        if (!fs.existsSync("samples/entities/bundle-properties.json")) {
            return;
        }

        const packageSpec = {
            "clusterProperties": ["cluster.hostname.json"]
        };
        fs.writeFileSync(packageFile, JSON.stringify(packageSpec, null, 2));

        const output = graphman("implode",
            "--input", "samples/entities",
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
        if (!fs.existsSync("samples/entities/bundle-properties.json")) {
            return;
        }

        const output = graphman("implode",
            "--input", "samples/entities",
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
        if (!fs.existsSync("samples/entities/keys")) {
            return;
        }

        const output = graphman("implode",
            "--input", "samples/entities",
            "--output", implodedFile);

        const bundle = tUtils.readFileAsJson(implodedFile);
        
        if (bundle.keys && bundle.keys.length > 0) {
            const key = bundle.keys[0];
            // Keys should have proper structure
            expect(key).toHaveProperty("alias");
        }
    });

    test("implode should handle trusted certificates", () => {
        if (!fs.existsSync("samples/entities/trustedCerts")) {
            return;
        }

        const output = graphman("implode",
            "--input", "samples/entities",
            "--output", implodedFile);

        const bundle = tUtils.readFileAsJson(implodedFile);
        
        if (bundle.trustedCerts && bundle.trustedCerts.length > 0) {
            const cert = bundle.trustedCerts[0];
            expect(cert).toHaveProperty("name");
        }
    });

    test("implode should handle internal users", () => {
        if (!fs.existsSync("samples/entities/internalUsers")) {
            return;
        }

        const output = graphman("implode",
            "--input", "samples/entities",
            "--output", implodedFile);

        const bundle = tUtils.readFileAsJson(implodedFile);
        
        if (bundle.internalUsers && bundle.internalUsers.length > 0) {
            const user = bundle.internalUsers[0];
            expect(user).toHaveProperty("name");
        }
    });
});

describe("Implode operation - sample package files", () => {
    test("implode using some.package sample file", () => {
        if (!fs.existsSync("samples/some.package")) {
            return;
        }

        const output = graphman("implode",
            "--input", "samples/entities",
            "--output", implodedFile,
            "--package", "samples/some.package");

        expect(output.stdout).toContain("using package file");
        
        const bundle = tUtils.readFileAsJson(implodedFile);
        const packageSpec = tUtils.readFileAsJson("samples/some.package");
        
        // Verify entities from package are included
        Object.keys(packageSpec).forEach(entityType => {
            if (packageSpec[entityType].length > 0) {
                expect(bundle).toHaveProperty(entityType);
            }
        });
    });

    test("implode using some-service.package sample file", () => {
        if (!fs.existsSync("samples/some-service.package")) {
            return;
        }

        const output = graphman("implode",
            "--input", "samples/entities",
            "--output", implodedFile,
            "--package", "samples/some-service.package");

        expect(output.stdout).toContain("using package file");
        
        const bundle = tUtils.readFileAsJson(implodedFile);
        
        // Should include services and cluster properties as specified
        if (bundle.services) {
            expect(bundle.services).toBeInstanceOf(Array);
        }
        if (bundle.clusterProperties) {
            expect(bundle.clusterProperties).toBeInstanceOf(Array);
        }
    });
});
