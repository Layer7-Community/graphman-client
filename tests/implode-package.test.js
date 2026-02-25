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
                {"source": "cluster.hostname.json"},
                {"source": "keyStore.defaultSsl.alias.json"}
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
                {"source": "cluster.hostname.json"},
                {"source": "non-existent-entity.json"}
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
            "clusterProperties": [{"source": "cluster.hostname.json"}],
            "keys": [{"source": "ssl-00000000000000000000000000000002.json"}]
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
                {"source": {"name": "cluster.hostname"}}
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
                {"source": {"goid": "2bf23f7e0c0bfc3d53358e1b5806a130"}}
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
                {"source": {"name": "non-existent-property"}}
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
                {"source": "cluster.hostname.json"},
                {"source": {"name": "keyStore.defaultSsl.alias"}}
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
    test("implode with package file should filter tree entities by summary", () => {
        // First, check what services exist in the entities
        const output = graphman("implode",
            "--input", explodedDir,
            "--output", implodedFile);
        
        const fullBundle = tUtils.readFileAsJson(implodedFile);
        
        if (fullBundle.services && fullBundle.services.length > 0) {
            const firstService = fullBundle.services[0];
            
            // Create package file with specific service
            const packageSpec = {
                "services": [{"source": {"resolutionPath": firstService.resolutionPath}}]
            };
            fs.writeFileSync(packageFile, JSON.stringify(packageSpec, null, 2));

            const filteredOutput = graphman("implode",
                "--input", explodedDir,
                "--output", implodedFile,
                "--package", packageFile);

            const filteredBundle = tUtils.readFileAsJson(implodedFile);
            
            expect(filteredBundle.services).toBeInstanceOf(Array);
            expect(filteredBundle.services.length).toBeLessThanOrEqual(fullBundle.services.length);
        }
    });

    test("implode with package file should filter tree entities by filename", () => {
        const output = graphman("implode",
            "--input", explodedDir,
            "--output", implodedFile);

        const fullBundle = tUtils.readFileAsJson(implodedFile);

        // Use the exact filename of a folderable entity from the tree
        const packageSpec = {
            "services": [{"source": "some-service-[+some-service-WEB_API].service.json"}]
        };
        fs.writeFileSync(packageFile, JSON.stringify(packageSpec, null, 2));

        const filteredOutput = graphman("implode",
            "--input", explodedDir,
            "--output", implodedFile,
            "--package", packageFile);

        const filteredBundle = tUtils.readFileAsJson(implodedFile);

        expect(filteredBundle.services).toBeInstanceOf(Array);
        expect(filteredBundle.services.length).toBe(1);
    });

    test("implode with package file should filter tree entities by wildcard filename", () => {
        const output = graphman("implode",
            "--input", explodedDir,
            "--output", implodedFile);

        const fullBundle = tUtils.readFileAsJson(implodedFile);

        // Use wildcard to match multiple policy fragment files
        const packageSpec = {
            "policies": [{"source": "some-*-policy-fragment-*.policy.json"}]
        };
        fs.writeFileSync(packageFile, JSON.stringify(packageSpec, null, 2));

        const filteredOutput = graphman("implode",
            "--input", explodedDir,
            "--output", implodedFile,
            "--package", packageFile);

        const filteredBundle = tUtils.readFileAsJson(implodedFile);

        if (filteredBundle.policyFragments) {
            expect(filteredBundle.policies).toBeInstanceOf(Array);
            expect(filteredBundle.policies.length).toBeLessThanOrEqual(fullBundle.policies.length);
        }
    });
});

describe("Implode operation - package file validation", () => {
    test("implode with non-existent package file should fail", () => {
        const output = graphman("implode",
            "--input", explodedDir,
            "--output", implodedFile,
            "--package", "non-existent-package.json");
        expect(output.stdout).toContain("package file does not exist");
    });

    test("implode with unknown entity type in package file should warn", () => {
        const packageSpec = {
            "unknownEntityType": [{"source": "some-file.json"}]
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

describe("Implode operation - wildcard filename support", () => {
    test("implode with wildcard * should match multiple entity files", () => {
        const packageSpec = {
            "clusterProperties": [
                {"source": "cluster.*.json"}
            ]
        };
        fs.writeFileSync(packageFile, JSON.stringify(packageSpec, null, 2));

        const output = graphman("implode",
            "--input", explodedDir,
            "--output", implodedFile,
            "--package", packageFile);

        const bundle = tUtils.readFileAsJson(implodedFile);

        expect(bundle).toHaveProperty("clusterProperties");
        expect(bundle.clusterProperties).toBeInstanceOf(Array);
        expect(bundle.clusterProperties.length).toBeGreaterThanOrEqual(1);
        bundle.clusterProperties.forEach(cp => {
            expect(cp.name).toMatch(/^cluster\./);
        });
    });

    test("implode with wildcard ? should match single character", () => {
        const packageSpec = {
            "clusterProperties": [
                {"source": "cluster.hostnam?.json"}
            ]
        };
        fs.writeFileSync(packageFile, JSON.stringify(packageSpec, null, 2));

        const output = graphman("implode",
            "--input", explodedDir,
            "--output", implodedFile,
            "--package", packageFile);

        const bundle = tUtils.readFileAsJson(implodedFile);

        if (bundle.clusterProperties) {
            expect(bundle.clusterProperties).toBeInstanceOf(Array);
            expect(bundle.clusterProperties.length).toBeGreaterThanOrEqual(1);
        }
    });

    test("implode with wildcard matching no files should warn", () => {
        const packageSpec = {
            "clusterProperties": [
                {"source": "zzz-no-match-*.json"}
            ]
        };
        fs.writeFileSync(packageFile, JSON.stringify(packageSpec, null, 2));

        const output = graphman("implode",
            "--input", explodedDir,
            "--output", implodedFile,
            "--package", packageFile);

        expect(output.stdout).toContain("no entity files matched wildcard");
    });

    test("implode with wildcard selecting all files in a section", () => {
        const packageSpec = {
            "clusterProperties": [
                {"source": "*.json"}
            ]
        };
        fs.writeFileSync(packageFile, JSON.stringify(packageSpec, null, 2));

        const output = graphman("implode",
            "--input", explodedDir,
            "--output", implodedFile,
            "--package", packageFile);

        const bundle = tUtils.readFileAsJson(implodedFile);

        expect(bundle).toHaveProperty("clusterProperties");
        expect(bundle.clusterProperties).toBeInstanceOf(Array);
        expect(bundle.clusterProperties.length).toBeGreaterThanOrEqual(1);
    });
});

describe("Implode operation - invalid package item format", () => {
    test("implode with old format (bare string) should warn about invalid format", () => {
        const packageSpec = {
            "clusterProperties": [
                "cluster.hostname.json"
            ]
        };
        fs.writeFileSync(packageFile, JSON.stringify(packageSpec, null, 2));

        const output = graphman("implode",
            "--input", explodedDir,
            "--output", implodedFile,
            "--package", packageFile);

        expect(output.stdout).toContain("invalid package item");
    });
});

describe("Implode operation - mapping filtering", () => {
    test("implode with package file should filter mappings to match selected entities", () => {

        const packageSpec = {
            "services": [
                {"source": {"resolutionPath": "/some-service"}}
            ]
        };
        fs.writeFileSync(packageFile, JSON.stringify(packageSpec, null, 2));

        const output = graphman("implode",
            "--input", explodedDir,
            "--output", implodedFile,
            "--package", packageFile);

        const bundle = tUtils.readFileAsJson(implodedFile);

        const mappings = bundle.properties.mappings.services;
        // All non-default mappings should match selected entities
        const nonDefaultMappings = mappings.filter(m => !m.default);
        nonDefaultMappings.forEach(mapping => {
            const source = mapping.source || mapping;
            // Should match one of our selected entities
            expect(source.resolutionPath).toBe("/some-service");
        });
    });
});

