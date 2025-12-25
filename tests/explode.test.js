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

// Helper to clean up exploded directory
function cleanupDir(dirPath) {
    if (fs.existsSync(dirPath)) {
        fs.rmSync(dirPath, { recursive: true, force: true });
    }
}

describe("explode command", () => {
    const testDir = tUtils.config().workspace;
    const explodedDir = path.join(testDir, "exploded");

    afterEach(() => {
        cleanupDir(explodedDir);
    });

    test("should throw error when --input parameter is missing", () => {
        expect(() => {
            graphman("explode", "--output", explodedDir);
        }).toThrow();
    });

    test("should throw error when --output parameter is missing", () => {
        const bundle = createTestBundle("test-bundle.json", {
            services: [{name: "Service1", resolutionPath: "/service1"}]
        });

        expect(() => {
            graphman("explode", "--input", bundle);
        }).toThrow();
    });

    test("should explode bundle with services into separate files", () => {
        const bundle = createTestBundle("test-bundle.json", {
            services: [
                {name: "Service1", resolutionPath: "/service1", enabled: true},
                {name: "Service2", resolutionPath: "/service2", enabled: false}
            ]
        });

        graphman("explode", "--input", bundle, "--output", explodedDir);

        expect(fs.existsSync(explodedDir)).toBe(true);
        expect(fs.existsSync(path.join(explodedDir, "services"))).toBe(true);
        
        const servicesDir = path.join(explodedDir, "services");
        const files = fs.readdirSync(servicesDir);
        expect(files).toContain("Service1.service.json");
        expect(files).toContain("Service2.service.json");

        const service1 = JSON.parse(fs.readFileSync(path.join(servicesDir, "Service1.service.json"), 'utf-8'));
        expect(service1).toMatchObject({
            name: "Service1",
            resolutionPath: "/service1",
            enabled: true
        });
    });

    test("should explode bundle with policies into separate files", () => {
        const bundle = createTestBundle("test-bundle.json", {
            policies: [
                {name: "Policy1", guid: "policy1-guid", folderPath: "/policies"},
                {name: "Policy2", guid: "policy2-guid", folderPath: "/policies"}
            ]
        });

        graphman("explode", "--input", bundle, "--output", explodedDir);

        expect(fs.existsSync(explodedDir)).toBe(true);
        expect(fs.existsSync(path.join(explodedDir, "tree", "policies"))).toBe(true);
        
        const policiesDir = path.join(explodedDir, "tree", "policies");
        const files = fs.readdirSync(policiesDir);
        expect(files).toContain("Policy1.policy.json");
        expect(files).toContain("Policy2.policy.json");
    });

    test("should explode bundle with cluster properties", () => {
        const bundle = createTestBundle("test-bundle.json", {
            clusterProperties: [
                {name: "prop1", value: "value1"},
                {name: "prop2", value: "value2"}
            ]
        });

        graphman("explode", "--input", bundle, "--output", explodedDir);

        expect(fs.existsSync(explodedDir)).toBe(true);
        expect(fs.existsSync(path.join(explodedDir, "clusterProperties"))).toBe(true);
        
        const propsDir = path.join(explodedDir, "clusterProperties");
        const files = fs.readdirSync(propsDir);
        expect(files.length).toBe(2);
    });

    test("should explode bundle with multiple entity types", () => {
        const bundle = createTestBundle("test-bundle.json", {
            services: [{name: "Service1", resolutionPath: "/service1"}],
            clusterProperties: [{name: "prop1", value: "value1"}],
            folders: [{name: "Folder1", folderPath: "/folder1"}]
        });

        graphman("explode", "--input", bundle, "--output", explodedDir);

        expect(fs.existsSync(path.join(explodedDir, "services"))).toBe(true);
        expect(fs.existsSync(path.join(explodedDir, "clusterProperties"))).toBe(true);
        expect(fs.existsSync(path.join(explodedDir, "folders"))).toBe(true);
    });

    test("should explode empty bundle", () => {
        const bundle = createTestBundle("empty-bundle.json", {});

        graphman("explode", "--input", bundle, "--output", explodedDir);

        expect(fs.existsSync(explodedDir)).toBe(true);
    });

    test("should explode bundle with bundle properties", () => {
        const bundle = createTestBundle("test-bundle.json", {
            services: [{name: "Service1", resolutionPath: "/service1"}],
            properties: {
                meta: {source: "test"}
            }
        });

        graphman("explode", "--input", bundle, "--output", explodedDir);

        expect(fs.existsSync(path.join(explodedDir, "bundle-properties.json"))).toBe(true);
        const props = JSON.parse(fs.readFileSync(path.join(explodedDir, "bundle-properties.json"), 'utf-8'));
        expect(props).toMatchObject({
            meta: {source: "test"}
        });
    });

    test("should explode bundle with level 0 option (default)", () => {
        const bundle = createTestBundle("test-bundle.json", {
            services: [{
                name: "Service1",
                resolutionPath: "/service1",
                policy: {xml: "<policy>test</policy>"}
            }]
        });

        graphman("explode", "--input", bundle, "--output", explodedDir, "--options.level", "0");

        const servicesDir = path.join(explodedDir, "services");
        const service = JSON.parse(fs.readFileSync(path.join(servicesDir, "Service1.service.json"), 'utf-8'));
        
        // At level 0, policy XML should remain inline
        expect(service.policy.xml).toBe("<policy>test</policy>");
    });

    test("should handle duplicate entity names", () => {
        const bundle = createTestBundle("test-bundle.json", {
            services: [
                {name: "Service1", resolutionPath: "/service1"},
                {name: "Service1", resolutionPath: "/service1"}
            ]
        });

        graphman("explode", "--input", bundle, "--output", explodedDir);

        const servicesDir = path.join(explodedDir, "services");
        const files = fs.readdirSync(servicesDir);
        
        // Should create files with unique names for duplicates
        expect(files.length).toBe(2);
        expect(files.filter(f => f.startsWith("Service1")).length).toBe(2);
    });

    test("should explode bundle with keys", () => {
        const bundle = createTestBundle("test-bundle.json", {
            keys: [
                {alias: "key1", keystore: "keystore1"},
                {alias: "key2", keystore: "keystore2"}
            ]
        });

        graphman("explode", "--input", bundle, "--output", explodedDir);

        expect(fs.existsSync(path.join(explodedDir, "keys"))).toBe(true);
        const keysDir = path.join(explodedDir, "keys");
        const files = fs.readdirSync(keysDir);
        expect(files.length).toBe(2);
    });

    test("should explode bundle with trusted certificates", () => {
        const bundle = createTestBundle("test-bundle.json", {
            trustedCerts: [
                {name: "cert1", thumbprintSha1: "thumb1"},
                {name: "cert2", thumbprintSha1: "thumb2"}
            ]
        });

        graphman("explode", "--input", bundle, "--output", explodedDir);

        expect(fs.existsSync(path.join(explodedDir, "trustedCerts"))).toBe(true);
        const certsDir = path.join(explodedDir, "trustedCerts");
        const files = fs.readdirSync(certsDir);
        expect(files.length).toBe(2);
    });

    test("should create folder structure for entities with folderPath", () => {
        const bundle = createTestBundle("test-bundle.json", {
            policies: [
                {name: "Policy1", guid: "guid1", folderPath: "/root/subfolder"},
                {name: "Policy2", guid: "guid2", folderPath: "/root/subfolder/deep"}
            ]
        });

        graphman("explode", "--input", bundle, "--output", explodedDir);

        expect(fs.existsSync(path.join(explodedDir, "tree", "root", "subfolder"))).toBe(true);
        expect(fs.existsSync(path.join(explodedDir, "tree", "root", "subfolder", "deep"))).toBe(true);
    });

    test("should explode bundle with policy fragments", () => {
        const bundle = createTestBundle("test-bundle.json", {
            policyFragments: [
                {name: "Fragment1", guid: "frag1-guid", folderPath: "/fragments"}
            ]
        });

        graphman("explode", "--input", bundle, "--output", explodedDir);

        expect(fs.existsSync(path.join(explodedDir, "tree", "fragments"))).toBe(true);
        const fragmentsDir = path.join(explodedDir, "tree", "fragments");
        const files = fs.readdirSync(fragmentsDir);
        expect(files).toContain("Fragment1.policy-fragment.json");
    });
});

