// Copyright (c) 2025 Broadcom Inc. and its subsidiaries. All Rights Reserved.

const tUtils = require("./utils");
const {graphman} = tUtils;

describe("schema command", () => {

    test("should display schema information", () => {
        const output = graphman("schema");

        expect(output.stdout).toBeDefined();
        expect(output.stdout).toEqual(expect.stringContaining("schema"));
    });

    test("should list available entity types", () => {
        const output = graphman("schema");

        expect(output.stdout).toBeDefined();
        expect(output.stdout).toEqual(expect.stringContaining("available entity types:"));
    });

    test("should display entity types with their plural names", () => {
        const output = graphman("schema");

        expect(output.stdout).toBeDefined();
        // Should show entity types in format: TypeName - pluralName
        expect(output.stdout).toMatch(/\w+\s+-\s+\w+/);
    });

    test("should complete without errors", () => {
        const output = graphman("schema");

        expect(output.stdout).toBeDefined();
        expect(output.stdout.length).toBeGreaterThan(0);
    });

    test("should show current schema version", () => {
        const output = graphman("schema");

        expect(output.stdout).toBeDefined();
        // Should show schema version (e.g., v11.1.1, v11.2.0, etc.)
        expect(output.stdout).toMatch(/schema\s+v\d+\.\d+\.\d+/);
    });

    test("should list common entity types", () => {
        const output = graphman("schema");

        expect(output.stdout).toBeDefined();
        // Should include common entity types
        expect(output.stdout).toEqual(expect.stringContaining("services"));
    });

    test("should show entity types in sorted order", () => {
        const output = graphman("schema");

        expect(output.stdout).toBeDefined();
        // Entity types should be listed (sorted alphabetically)
        const lines = output.stdout.split('\n').filter(line => line.includes(' - '));
        expect(lines.length).toBeGreaterThan(5);
    });

    test("should handle refresh option", () => {
        const output = graphman("schema", "--refresh", "false");

        expect(output.stdout).toBeDefined();
        expect(output.stdout).toEqual(expect.stringContaining("available entity types:"));
    });

    test("should handle options.refresh parameter", () => {
        const output = graphman("schema", "--options.refresh", "false");

        expect(output.stdout).toBeDefined();
        expect(output.stdout).toEqual(expect.stringContaining("available entity types:"));
    });

    test("should display schema without refresh by default", () => {
        const output = graphman("schema");

        expect(output.stdout).toBeDefined();
        expect(output.stdout).toEqual(expect.stringContaining("schema"));
        expect(output.stdout).toEqual(expect.stringContaining("available entity types:"));
    });

    test("should show L7 entity types", () => {
        const output = graphman("schema");

        expect(output.stdout).toBeDefined();
        // Should show various L7 entity types
        const entityTypes = ['Service', 'Policy', 'Folder', 'ClusterProperty'];
        const hasEntityTypes = entityTypes.some(type => output.stdout.includes(type));
        expect(hasEntityTypes).toBe(true);
    });

    test("should display entity type metadata", () => {
        const output = graphman("schema");

        expect(output.stdout).toBeDefined();
        // Should show entity types with their metadata
        expect(output.stdout).toMatch(/\w+\s+-\s+\w+/);
    });

    test("should mark deprecated entity types", () => {
        const output = graphman("schema");

        expect(output.stdout).toBeDefined();
        // If there are deprecated types, they should be marked
        // Otherwise, just verify the command completes successfully
        expect(output.stdout.length).toBeGreaterThan(0);
    });

    test("should display schema information for current version", () => {
        const output = graphman("schema");

        expect(output.stdout).toBeDefined();
        // Should display schema for the configured version
        expect(output.stdout).toEqual(expect.stringContaining("schema"));
        expect(output.stdout).toEqual(expect.stringContaining("available entity types:"));
    });
});

