
const fs = require('fs');
const cp = require('child_process');

const metadata = JSON.parse(fs.readFileSync("schema/metadata-base.json"));
let execFile = "graphman.bat";
let wspace = "build/tests";

metadata.typeInfoByBundleName = {};
metadata.typeInfoByTypeName = {};

metadata.typeInfos.forEach(item => {
    metadata.typeInfoByBundleName[item.bundleName] = item;
    metadata.typeInfoByTypeName[item.typeName.toLowerCase()] = item;
});

metadata.mutationMethod = function (bundleName, prefix) {
    return bundleName === "smConfigs" ?
        prefix + bundleName.substring(0, 2).toUpperCase() + bundleName.substring(2) :
        prefix + bundleName.substring(0, 1).toUpperCase() + bundleName.substring(1);
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
}

module.exports = {
    config: function (cfg) {
        if (cfg.exec) execFile = cfg.exec;
        if (cfg.wspace) wspace = cfg.wspace;
    },

    metadata: function () {
        return metadata;
    },

    graphman: function (...args) {
        const outputFile = wspace + "/output.json";

        if (args.indexOf("--output") == -1) {
            args.push("--output");
            args.push(outputFile);
        }

        if (fs.existsSync(outputFile)) fs.unlinkSync(outputFile);
        const stdOutput = String(cp.execFileSync(execFile, args));
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
