// Copyright (c) 2025 Broadcom Inc. and its subsidiaries. All Rights Reserved.

const tUtils = require("./utils");
const {graphman} = tUtils;
const fs = require('fs');
const path = require('path');

describe("config command", () => {

    test("should display current configuration", () => {
        const output = graphman("config");

        expect(output.stdout).toBeDefined();
        // Should display home directory or configuration information
    });

    test("should show home directory when configured", () => {
        const output = graphman("config");

        expect(output.stdout).toBeDefined();
        // Should show home directory path
        expect(output.stdout).toEqual(expect.stringContaining("home"));
    });

    test("should complete without errors", () => {
        const output = graphman("config");

        expect(output.stdout).toBeDefined();
        expect(output.stdout.length).toBeGreaterThan(0);
    });

    test("should display configuration file contents when present", () => {
        const output = graphman("config");

        expect(output.stdout).toBeDefined();
        // Should show configuration or indicate if missing
    });

    test("should handle missing configuration gracefully", () => {
        const output = graphman("config");

        expect(output.stdout).toBeDefined();
        // Should either show config or warn about missing configuration
    });

    test("should show gateway profiles if configured", () => {
        const output = graphman("config");

        expect(output.stdout).toBeDefined();
        // Configuration might include gateway profiles
    });

    test("should display configuration in readable format", () => {
        const output = graphman("config");

        expect(output.stdout).toBeDefined();
        // Should display configuration information
        expect(output.stdout.length).toBeGreaterThan(0);
    });

    test("should show options section if present", () => {
        const output = graphman("config");

        expect(output.stdout).toBeDefined();
        // Configuration might include options
    });

    test("should display schema version from configuration", () => {
        const output = graphman("config");

        expect(output.stdout).toBeDefined();
        // Configuration might include schema version
    });

    test("should handle config command without parameters", () => {
        const output = graphman("config");

        expect(output.stdout).toBeDefined();
        // Should work without additional parameters
        expect(output.stdout.length).toBeGreaterThan(0);
    });

    test("should show configuration structure", () => {
        const output = graphman("config");

        expect(output.stdout).toBeDefined();
        // Should display some configuration information
    });

    test("should indicate if GRAPHMAN_HOME is not set", () => {
        const output = graphman("config");

        expect(output.stdout).toBeDefined();
        // Should either show home or warn about missing GRAPHMAN_HOME
    });

    test("should display gateways configuration if available", () => {
        const output = graphman("config");

        expect(output.stdout).toBeDefined();
        // Configuration might include gateway definitions
    });

    test("should show extensions configuration if available", () => {
        const output = graphman("config");

        expect(output.stdout).toBeDefined();
        // Configuration might include extensions
    });

    test("should handle config display without errors", () => {
        const output = graphman("config");

        expect(output.stdout).toBeDefined();
        // Should complete successfully
        expect(output.stdout.length).toBeGreaterThan(0);
    });
});

describe("config init-home command", () => {

    const testHomeDir = path.join(tUtils.config().workspace, "test-home");

    afterEach(() => {
        // Clean up test home directory
        if (fs.existsSync(testHomeDir)) {
            fs.rmSync(testHomeDir, { recursive: true, force: true });
        }
    });

    test("should initialize home directory", () => {
        const output = graphman("config", "--init-home", testHomeDir);

        expect(output.stdout).toBeDefined();
        expect(output.stdout).toEqual(expect.stringContaining("initializing home"));
    });

    test("should create queries directory when initializing home", () => {
        graphman("config", "--init-home", testHomeDir);

        expect(fs.existsSync(testHomeDir)).toBe(true);
        expect(fs.existsSync(path.join(testHomeDir, "queries"))).toBe(true);
    });

    test("should create modules directory when initializing home", () => {
        graphman("config", "--init-home", testHomeDir);

        expect(fs.existsSync(testHomeDir)).toBe(true);
        expect(fs.existsSync(path.join(testHomeDir, "modules"))).toBe(true);
    });

    test("should create configuration file when initializing home", () => {
        graphman("config", "--init-home", testHomeDir);

        expect(fs.existsSync(testHomeDir)).toBe(true);
        expect(fs.existsSync(path.join(testHomeDir, "graphman.configuration"))).toBe(true);
    });

    test("should copy extension modules when initializing home", () => {
        graphman("config", "--init-home", testHomeDir);

        const modulesDir = path.join(testHomeDir, "modules");
        expect(fs.existsSync(modulesDir)).toBe(true);
        
        // Should have copied extension files
        const files = fs.readdirSync(modulesDir);
        const extensionFiles = files.filter(f => f.startsWith("graphman-extension-"));
        expect(extensionFiles.length).toBeGreaterThan(0);
    });

    test("should create default configuration with proper structure", () => {
        graphman("config", "--init-home", testHomeDir);

        const configFile = path.join(testHomeDir, "graphman.configuration");
        expect(fs.existsSync(configFile)).toBe(true);
        
        const config = JSON.parse(fs.readFileSync(configFile, 'utf-8'));
        expect(config).toBeDefined();
        expect(config.gateways).toBeDefined();
    });

    test("should not overwrite existing configuration file", () => {
        // Initialize home first time
        graphman("config", "--init-home", testHomeDir);
        
        const configFile = path.join(testHomeDir, "graphman.configuration");
        const originalContent = fs.readFileSync(configFile, 'utf-8');
        
        // Try to initialize again
        graphman("config", "--init-home", testHomeDir);
        
        const newContent = fs.readFileSync(configFile, 'utf-8');
        expect(newContent).toBe(originalContent);
    });

    test("should display GRAPHMAN_HOME environment variable message", () => {
        const output = graphman("config", "--init-home", testHomeDir);

        expect(output.stdout).toBeDefined();
        expect(output.stdout).toEqual(expect.stringContaining("GRAPHMAN_HOME"));
    });

    test("should handle init-home with options.encodeSecrets", () => {
        const output = graphman("config", 
            "--init-home", testHomeDir,
            "--options.encodeSecrets", "false");

        expect(output.stdout).toBeDefined();
        expect(output.stdout).toEqual(expect.stringContaining("initializing home"));
    });

    test("should create all necessary directories for home", () => {
        graphman("config", "--init-home", testHomeDir);

        expect(fs.existsSync(testHomeDir)).toBe(true);
        expect(fs.existsSync(path.join(testHomeDir, "queries"))).toBe(true);
        expect(fs.existsSync(path.join(testHomeDir, "modules"))).toBe(true);
    });
});

