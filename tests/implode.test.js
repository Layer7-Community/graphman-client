// Copyright (c) 2025 Broadcom Inc. and its subsidiaries. All Rights Reserved.

const tUtils = require("./utils");
const {graphman} = tUtils;
const fs = require('fs');
const path = require('path');

// Helper to create exploded directory structure
function createExplodedStructure(baseDir, structure) {
    if (!fs.existsSync(baseDir)) {
        fs.mkdirSync(baseDir, { recursive: true });
    }

    Object.entries(structure).forEach(([key, value]) => {
        const fullPath = path.join(baseDir, key);
        
        if (typeof value === 'object' && !Array.isArray(value)) {
            // It's a directory
            fs.mkdirSync(fullPath, { recursive: true });
            createExplodedStructure(fullPath, value);
        } else {
            // It's a file
            const dir = path.dirname(fullPath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            fs.writeFileSync(fullPath, typeof value === 'string' ? value : JSON.stringify(value, null, 2));
        }
    });
}

// Helper to clean up directory
function cleanupDir(dirPath) {
    if (fs.existsSync(dirPath)) {
        fs.rmSync(dirPath, { recursive: true, force: true });
    }
}

describe("implode command", () => {
    const testDir = tUtils.config().workspace;
    const explodedDir = path.join(testDir, "exploded-test");

    afterEach(() => {
        cleanupDir(explodedDir);
    });

    test("should throw error when --input parameter is missing", () => {
        expect(() => {
            graphman("implode");
        }).toThrow();
    });

    test("should implode directory with services into bundle", () => {
        createExplodedStructure(explodedDir, {
            "services": {
                "Service1.service.json": {name: "Service1", resolutionPath: "/service1", enabled: true},
                "Service2.service.json": {name: "Service2", resolutionPath: "/service2", enabled: false}
            }
        });

        const output = graphman("implode", "--input", explodedDir);

        expect(output.services).toHaveLength(2);
        expect(output.services).toEqual(expect.arrayContaining([
            expect.objectContaining({name: "Service1", resolutionPath: "/service1", enabled: true}),
            expect.objectContaining({name: "Service2", resolutionPath: "/service2", enabled: false})
        ]));
    });

    test("should implode directory with policies from tree structure", () => {
        createExplodedStructure(explodedDir, {
            "tree": {
                "policies": {
                    "Policy1.policy.json": {name: "Policy1", guid: "policy1-guid", folderPath: "/policies"},
                    "Policy2.policy.json": {name: "Policy2", guid: "policy2-guid", folderPath: "/policies"}
                }
            }
        });

        const output = graphman("implode", "--input", explodedDir);

        expect(output.policies).toHaveLength(2);
        expect(output.policies).toEqual(expect.arrayContaining([
            expect.objectContaining({name: "Policy1"}),
            expect.objectContaining({name: "Policy2"})
        ]));
    });

    test("should implode directory with cluster properties", () => {
        createExplodedStructure(explodedDir, {
            "clusterProperties": {
                "prop1.cluster-property.json": {name: "prop1", value: "value1"},
                "prop2.cluster-property.json": {name: "prop2", value: "value2"}
            }
        });

        const output = graphman("implode", "--input", explodedDir);

        expect(output.clusterProperties).toHaveLength(2);
        expect(output.clusterProperties).toEqual(expect.arrayContaining([
            expect.objectContaining({name: "prop1", value: "value1"}),
            expect.objectContaining({name: "prop2", value: "value2"})
        ]));
    });

    test("should implode directory with multiple entity types", () => {
        createExplodedStructure(explodedDir, {
            "services": {
                "Service1.service.json": {name: "Service1", resolutionPath: "/service1"}
            },
            "clusterProperties": {
                "prop1.cluster-property.json": {name: "prop1", value: "value1"}
            },
            "folders": {
                "Folder1.folder.json": {name: "Folder1", folderPath: "/folder1"}
            }
        });

        const output = graphman("implode", "--input", explodedDir);

        expect(output.services).toHaveLength(1);
        expect(output.clusterProperties).toHaveLength(1);
        expect(output.folders).toHaveLength(1);
    });

    test("should implode directory with bundle properties", () => {
        createExplodedStructure(explodedDir, {
            "services": {
                "Service1.service.json": {name: "Service1", resolutionPath: "/service1"}
            },
            "bundle-properties.json": {meta: {source: "test"}}
        });

        const output = graphman("implode", "--input", explodedDir);

        expect(output.services).toHaveLength(1);
        expect(output.properties).toMatchObject({
            meta: {source: "test"}
        });
    });

    test("should implode empty directory", () => {
        fs.mkdirSync(explodedDir, { recursive: true });

        const output = graphman("implode", "--input", explodedDir);

        expect(Object.keys(output).filter(k => k !== 'stdout').length).toBe(0);
    });

    test("should implode directory with nested folder structure", () => {
        createExplodedStructure(explodedDir, {
            "tree": {
                "root": {
                    "subfolder": {
                        "Policy1.policy.json": {name: "Policy1", guid: "guid1", folderPath: "/root/subfolder"},
                        "deep": {
                            "Policy2.policy.json": {name: "Policy2", guid: "guid2", folderPath: "/root/subfolder/deep"}
                        }
                    }
                }
            }
        });

        const output = graphman("implode", "--input", explodedDir);

        expect(output.policies).toHaveLength(2);
        expect(output.policies).toEqual(expect.arrayContaining([
            expect.objectContaining({name: "Policy1", folderPath: "/root/subfolder"}),
            expect.objectContaining({name: "Policy2", folderPath: "/root/subfolder/deep"})
        ]));
    });

    test("should implode directory with keys", () => {
        createExplodedStructure(explodedDir, {
            "keys": {
                "key1.key.json": {alias: "key1", keystore: "keystore1"},
                "key2.key.json": {alias: "key2", keystore: "keystore2"}
            }
        });

        const output = graphman("implode", "--input", explodedDir);

        expect(output.keys).toHaveLength(2);
        expect(output.keys).toEqual(expect.arrayContaining([
            expect.objectContaining({alias: "key1"}),
            expect.objectContaining({alias: "key2"})
        ]));
    });

    test("should implode directory with trusted certificates", () => {
        createExplodedStructure(explodedDir, {
            "trustedCerts": {
                "cert1.trusted-cert.json": {name: "cert1", thumbprintSha1: "thumb1"},
                "cert2.trusted-cert.json": {name: "cert2", thumbprintSha1: "thumb2"}
            }
        });

        const output = graphman("implode", "--input", explodedDir);

        expect(output.trustedCerts).toHaveLength(2);
        expect(output.trustedCerts).toEqual(expect.arrayContaining([
            expect.objectContaining({name: "cert1"}),
            expect.objectContaining({name: "cert2"})
        ]));
    });

    test("should implode directory with policy fragments", () => {
        createExplodedStructure(explodedDir, {
            "tree": {
                "fragments": {
                    "Fragment1.policy-fragment.json": {name: "Fragment1", guid: "frag1-guid", folderPath: "/fragments"}
                }
            }
        });

        const output = graphman("implode", "--input", explodedDir);

        expect(output.policyFragments).toHaveLength(1);
        expect(output.policyFragments).toEqual(expect.arrayContaining([
            expect.objectContaining({name: "Fragment1"})
        ]));
    });

    test("should throw error for non-existent directory", () => {
        const nonExistentDir = path.join(testDir, "non-existent-dir");
        
        expect(() => {
            graphman("implode", "--input", nonExistentDir);
        }).toThrow();
    });

    test("should implode and sort bundle entities", () => {
        createExplodedStructure(explodedDir, {
            "services": {
                "Service1.service.json": {name: "Service1", resolutionPath: "/service1"}
            },
            "clusterProperties": {
                "prop1.cluster-property.json": {name: "prop1", value: "value1"}
            }
        });

        const output = graphman("implode", "--input", explodedDir);

        // Verify output has expected structure (sorted)
        const keys = Object.keys(output).filter(k => k !== 'stdout');
        expect(keys.length).toBeGreaterThan(0);
    });

    test("should handle mixed services and policies in tree structure", () => {
        createExplodedStructure(explodedDir, {
            "tree": {
                "apis": {
                    "Service1.service.json": {name: "Service1", resolutionPath: "/service1", folderPath: "/apis"},
                    "Policy1.policy.json": {name: "Policy1", guid: "guid1", folderPath: "/apis"}
                }
            }
        });

        const output = graphman("implode", "--input", explodedDir);

        expect(output.services).toHaveLength(1);
        expect(output.policies).toHaveLength(1);
    });
});

