/*
 * Copyright ©  2024. Broadcom Inc. and/or its subsidiaries. All Rights Reserved.
 */

const fs = require('fs');
const cp = require('child_process');
const tConfig = init();

module.exports = {
    config: function (cfg) {
        if (cfg) {
            Object.assign(tConfig, cfg);
        }

        return tConfig;
    },

    load: function (name) {
        return require(tConfig.home + "/modules/" + name);
    },

    metadata: function () {
        return tConfig.metadata;
    },

    graphman: function (...args) {
        const outputFile = tConfig.workspace + "/output.json";

        if (args.indexOf("--output") === -1) {
            args.push("--output");
            args.push(outputFile);
        }

        if (fs.existsSync(outputFile)) fs.unlinkSync(outputFile);
        const stdOutput = String(cp.execFileSync(tConfig.execFile, args));
        console.log(stdOutput);
        const output = fs.existsSync(outputFile)? String(fs.readFileSync(outputFile)) : "{}";
        console.log(output);
        const json = JSON.parse(output);
        json.stdout = stdOutput;
        return json;
    },

    expectArray: function (actual) {
        return {
            toContainEqual: function (...expected) {
                const expectObj = expect(actual);
                expected.forEach(item => expectObj.toContainEqual(expect.objectContaining(item)));
            }
        }
    },
    
    readFileAsJson: function (path) {
        return JSON.parse(fs.readFileSync(path));
    }
};

function init() {
    const tConfig = {
        home: process.env.GRAPHMAN_HOME,
        execFile: process.env.GRAPHMAN_ENTRYPOINT || "graphman.sh",
        workspace: (process.env.GRAPHMAN_HOME + "/build" || "build") + "/tests",
        schemaVersion: process.env.GRAPHMAN_SCHEMA || "v11.2.0"
    };

    const modulePath = tConfig.home + "/modules/graphman.js";
    if (fs.existsSync(modulePath)) {
        require(modulePath).init(tConfig.home, {options:{}});
    }

    tConfig.metadata = initMetadata(tConfig);

    return tConfig;
}

function initMetadata(tConfig) {
    const metadata = JSON.parse(fs.readFileSync(tConfig.home + "/schema/" + tConfig.schemaVersion + "/metadata.json", 'utf-8'));
    metadata.typeInfoByBundleName = {};
    metadata.typeInfoByTypeName = {};

    Object.entries(metadata.types).forEach(([key, item]) => {
        if (item.isL7Entity) {
            metadata.typeInfoByBundleName[item.pluralName] = item;
            metadata.typeInfoByTypeName[item.typeName.toLowerCase()] = item;
        }
    });

    metadata.typeInfos = function () {
        return Object.values(metadata.types).filter(item => item.isL7Entity);
    };

    metadata.mutationMethod = function (pluralName, prefix) {
        return pluralName === "smConfigs" ?
            prefix + pluralName.substring(0, 2).toUpperCase() + pluralName.substring(2) :
            prefix + pluralName.substring(0, 1).toUpperCase() + pluralName.substring(1);
    };

    metadata.typeInfoByVariableBundleName = function (arg) {
        let typeInfo = metadata.typeInfoByBundleName(arg);

        if (typeInfo == null) {
            if (arg.startsWith("set")) typeInfo = metadata.typeInfoByBundleName(arg.substring("set".length));
            if (arg.startsWith("delete")) typeInfo = metadata.typeInfoByBundleName(arg.substring("delete".length));
            if (arg.startsWith("create")) typeInfo = metadata.typeInfoByBundleName(arg.substring("create".length));
            if (arg.startsWith("update")) typeInfo = metadata.typeInfoByBundleName(arg.substring("update".length));
            if (arg.indexOf("By") !== -1) {
                const partialArg = arg.substring(0, arg.indexOf("By"));
                typeInfo = metadata.typeInfoByBundleName(partialArg);
                if (typeInfo == null) typeInfo = metadata.typeInfoByTypeName(partialArg.toLowerCase());
            }
        }

        return typeInfo;
    };

    return metadata;
}
