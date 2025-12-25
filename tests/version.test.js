// Copyright (c) 2025 Broadcom Inc. and its subsidiaries. All Rights Reserved.

const tUtils = require("./utils");
const {graphman} = tUtils;

describe("version command", () => {

    test("should display version information", () => {
        const output = graphman("version");

        expect(output.stdout).toBeDefined();
        expect(output.stdout).toEqual(expect.stringContaining("graphman client"));
    });

    test("should display schema version", () => {
        const output = graphman("version");

        expect(output.stdout).toBeDefined();
        expect(output.stdout).toEqual(expect.stringContaining("schema"));
    });

    test("should display supported schema versions", () => {
        const output = graphman("version");

        expect(output.stdout).toBeDefined();
        expect(output.stdout).toEqual(expect.stringContaining("supported schema(s)"));
    });

    test("should display supported extensions", () => {
        const output = graphman("version");

        expect(output.stdout).toBeDefined();
        expect(output.stdout).toEqual(expect.stringContaining("supported extension(s)"));
    });

    test("should display home directory", () => {
        const output = graphman("version");

        expect(output.stdout).toBeDefined();
        expect(output.stdout).toEqual(expect.stringContaining("home"));
    });

    test("should display github link", () => {
        const output = graphman("version");

        expect(output.stdout).toBeDefined();
        expect(output.stdout).toEqual(expect.stringContaining("github"));
    });

    test("should complete without errors", () => {
        const output = graphman("version");

        expect(output.stdout).toBeDefined();
        expect(output.stdout.length).toBeGreaterThan(0);
    });

    test("should display version with proper formatting", () => {
        const output = graphman("version");

        expect(output.stdout).toBeDefined();
        // Should contain multiple lines of version information
        const lines = output.stdout.split('\n').filter(line => line.trim().length > 0);
        expect(lines.length).toBeGreaterThan(3);
    });

    test("should show current schema version being used", () => {
        const output = graphman("version");

        expect(output.stdout).toBeDefined();
        // Should show schema version (e.g., v11.1.1, v11.2.0, etc.)
        expect(output.stdout).toMatch(/schema\s+v\d+\.\d+\.\d+/);
    });

    test("should list multiple supported schema versions", () => {
        const output = graphman("version");

        expect(output.stdout).toBeDefined();
        // Should show supported schemas in bracket format
        expect(output.stdout).toMatch(/supported schema\(s\)\s+\[.*\]/);
    });

    test("should show extension information", () => {
        const output = graphman("version");

        expect(output.stdout).toBeDefined();
        // Should show supported extensions
        expect(output.stdout).toMatch(/supported extension\(s\)\s+\[.*\]/);
    });
});

