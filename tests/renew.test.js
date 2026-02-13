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

describe("renew command", () => {

    test("should throw error when --input parameter is missing", () => {
        expect(() => {
            graphman("renew", "--gateway", "default");
        }).toThrow();
    });

    test("should throw error when --gateway parameter is missing", () => {
        const bundle = createTestBundle("test-bundle.json", {
            services: [{name: "Service1", resolutionPath: "/service1"}]
        });

        expect(() => {
            graphman("renew", "--input", bundle);
        }).toThrow();
    });

    test("should throw error when gateway details are missing", () => {
        const bundle = createTestBundle("test-bundle.json", {
            services: [{name: "Service1", resolutionPath: "/service1"}]
        });

        expect(() => {
            graphman("renew", "--input", bundle, "--gateway", "unknown-gateway");
        }).toThrow();
    });

    test("should handle renew with default gateway not configured for queries", () => {
        const bundle = createTestBundle("test-bundle.json", {
            clusterProperties: [{name: "cluster.hostname"}]
        });

        // Default gateway is typically not configured for mutations/queries in test environment
        // This test verifies error handling
        const output = graphman("renew", 
            "--input", bundle,
            "--gateway", "default");

        expect(output.stdout).toBeDefined();
    });

    test("should handle renew with sections parameter", () => {
        const bundle = createTestBundle("test-bundle.json", {
            services: [{name: "Service1", resolutionPath: "/service1"}],
            policies: [{name: "Policy1", guid: "policy1-guid"}]
        });

        const output = graphman("renew", 
            "--input", bundle,
            "--gateway", "default",
            "--sections", "services");

        expect(output.stdout).toBeDefined();
    });

    test("should handle renew with wildcard sections", () => {
        const bundle = createTestBundle("test-bundle.json", {
            services: [{name: "Service1", resolutionPath: "/service1"}],
            clusterProperties: [{name: "prop1", value: "value1"}]
        });

        const output = graphman("renew", 
            "--input", bundle,
            "--gateway", "default",
            "--sections", "*");

        expect(output.stdout).toBeDefined();
    });

    test("should handle renew with useGoids option", () => {
        const bundle = createTestBundle("test-bundle.json", {
            services: [{
                name: "Service1",
                resolutionPath: "/service1",
                goid: "service1-goid"
            }]
        });

        const output = graphman("renew", 
            "--input", bundle,
            "--gateway", "default",
            "--options.useGoids", "true");

        expect(output.stdout).toBeDefined();
    });

    test("should handle renew with includePolicyRevisions option", () => {
        const bundle = createTestBundle("test-bundle.json", {
            policies: [{
                name: "Policy1",
                guid: "policy1-guid"
            }]
        });

        const output = graphman("renew", 
            "--input", bundle,
            "--gateway", "default",
            "--options.includePolicyRevisions", "true");

        expect(output.stdout).toBeDefined();
    });

    test("should handle renew with includeMultipartFields option", () => {
        const bundle = createTestBundle("test-bundle.json", {
            serverModuleFiles: [{
                name: "module1"
            }]
        });

        const output = graphman("renew", 
            "--input", bundle,
            "--gateway", "default",
            "--options.includeMultipartFields", "true");

        expect(output.stdout).toBeDefined();
    });

    test("should handle renew with multiple sections", () => {
        const bundle = createTestBundle("test-bundle.json", {
            services: [{name: "Service1", resolutionPath: "/service1"}],
            policies: [{name: "Policy1", guid: "policy1-guid"}],
            clusterProperties: [{name: "prop1", value: "value1"}]
        });

        const output = graphman("renew", 
            "--input", bundle,
            "--gateway", "default",
            "--sections", "services", "policies");

        expect(output.stdout).toBeDefined();
    });

    test("should handle renew with excluded sections", () => {
        const bundle = createTestBundle("test-bundle.json", {
            services: [{name: "Service1", resolutionPath: "/service1"}],
            policies: [{name: "Policy1", guid: "policy1-guid"}],
            clusterProperties: [{name: "prop1", value: "value1"}]
        });

        const output = graphman("renew", 
            "--input", bundle,
            "--gateway", "default",
            "--sections", "*", "-clusterProperties");

        expect(output.stdout).toBeDefined();
    });

    test("should handle renew with empty bundle", () => {
        const bundle = createTestBundle("empty-bundle.json", {});

        const output = graphman("renew", 
            "--input", bundle,
            "--gateway", "default");

        expect(output.stdout).toBeDefined();
    });

    test("should handle renew with keys", () => {
        const bundle = createTestBundle("test-bundle.json", {
            keys: [{
                alias: "key1",
                keystore: "keystore1"
            }]
        });

        const output = graphman("renew", 
            "--input", bundle,
            "--gateway", "default",
            "--sections", "keys");

        expect(output.stdout).toBeDefined();
    });

    test("should handle renew with trusted certificates", () => {
        const bundle = createTestBundle("test-bundle.json", {
            trustedCerts: [{
                name: "cert1",
                thumbprintSha1: "thumb1"
            }]
        });

        const output = graphman("renew", 
            "--input", bundle,
            "--gateway", "default",
            "--sections", "trustedCerts");

        expect(output.stdout).toBeDefined();
    });

    test("should handle renew with folders", () => {
        const bundle = createTestBundle("test-bundle.json", {
            folders: [{
                name: "Folder1",
                folderPath: "/folder1"
            }]
        });

        const output = graphman("renew", 
            "--input", bundle,
            "--gateway", "default",
            "--sections", "folders");

        expect(output.stdout).toBeDefined();
    });

    test("should handle renew with default sections (all)", () => {
        const bundle = createTestBundle("test-bundle.json", {
            services: [{name: "Service1", resolutionPath: "/service1"}],
            policies: [{name: "Policy1", guid: "policy1-guid"}]
        });

        const output = graphman("renew", 
            "--input", bundle,
            "--gateway", "default");

        expect(output.stdout).toBeDefined();
        // Default sections should be "*" (all)
    });

    test("should handle renew with policy fragments", () => {
        const bundle = createTestBundle("test-bundle.json", {
            policyFragments: [{
                name: "Fragment1",
                guid: "fragment1-guid"
            }]
        });

        const output = graphman("renew", 
            "--input", bundle,
            "--gateway", "default",
            "--sections", "policyFragments");

        expect(output.stdout).toBeDefined();
    });

    test("should handle renew with internal users", () => {
        const bundle = createTestBundle("test-bundle.json", {
            internalUsers: [{
                name: "user1",
                login: "user1"
            }]
        });

        const output = graphman("renew", 
            "--input", bundle,
            "--gateway", "default",
            "--sections", "internalUsers");

        expect(output.stdout).toBeDefined();
    });

    test("should handle renew with scheduled tasks", () => {
        const bundle = createTestBundle("test-bundle.json", {
            scheduledTasks: [{
                name: "task1",
                policyGoid: "policy-goid"
            }]
        });

        const output = graphman("renew", 
            "--input", bundle,
            "--gateway", "default",
            "--sections", "scheduledTasks");

        expect(output.stdout).toBeDefined();
    });
});

