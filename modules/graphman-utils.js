/*
 * Copyright ©  2024. Broadcom Inc. and/or its subsidiaries. All Rights Reserved.
 */

const fs = require("fs");
const putil = require("path");
const HOME_DIR = process.env.GRAPHMAN_HOME;
const MODULES_DIR = HOME_DIR + "/modules";
const QUERIES_DIR = HOME_DIR + "/queries";
const SCHEMA_DIR = HOME_DIR + "/schema";
const SCHEMA_METADATA_BASE_FILE = "metadata-base.json";
const SCHEMA_METADATA_FILE = "metadata.json";
const POLICY_SCHEMA_FILE = "policy-code-schema.json";

const NONE_LEVEL = 0;
const WARN_LEVEL = 1;
const INFO_LEVEL = 2;
const FINE_LEVEL = 3;
const DEBUG_LEVEL = 10;
let logLevel = INFO_LEVEL;

const defaultExtn = {ref: {apply: function (input) {return input;}}};
const extns = {};

class GraphmanOperationError extends Error {
    constructor(message) {
        super(message);
        this.name = 'GraphmanOperationError';
    }
}

module.exports = {
    newError: function (msg) {
        return new GraphmanOperationError(msg);
    },

    loggingAt: function (level) {
        if (level === 'warn' && logLevel === WARN_LEVEL) return true;
        else if (level === 'info' && logLevel === INFO_LEVEL) return true;
        else if (level === 'fine' && logLevel === FINE_LEVEL) return true;
        else return level === 'debug' && logLevel === DEBUG_LEVEL;
    },

    logAt: function (level) {
        if (level === 'warn') {
            logLevel = WARN_LEVEL;
        } else if (level === 'info') {
            logLevel = INFO_LEVEL;
        } else if (level === 'fine') {
            logLevel = FINE_LEVEL;
        } else if (level === 'debug') {
            logLevel = DEBUG_LEVEL;
        } else if (level === 'nolog') {
            logLevel = NONE_LEVEL;
        }
    },

    home: function () {
        return HOME_DIR;
    },

    modulesDir: function () {
        return MODULES_DIR;
    },

    schemasDir: function () {
        return SCHEMA_DIR;
    },

    schemaDir: function (schemaVersion) {
        const path = this.path(SCHEMA_DIR, schemaVersion);
        if (!this.existsFile(path)) {
            throw this.newError("schema directory is missing, path=" + path);
        }

        return path;
    },

    schemaMetadataBaseFile: function (schemaVersion) {
        return this.path(this.schemaDir(schemaVersion), SCHEMA_METADATA_BASE_FILE);
    },

    schemaMetadataFile: function (schemaVersion) {
        return this.path(this.schemaDir(schemaVersion), SCHEMA_METADATA_FILE);
    },

    policySchemaFile: function (schemaVersion) {
      return this.path(this.schemaDir(schemaVersion), POLICY_SCHEMA_FILE)
    },

    queriesDir: function () {
        return QUERIES_DIR;
    },

    queryFile: function (query, schemaVersion) {
       const path = this.path(this.queriesDir(), schemaVersion, query);
       if (this.existsFile(path)) return path;
       return this.path(this.queriesDir(), query);
    },

    isDirectory: function (fd) {
        const stat = fs.statSync(fd);
        return stat && stat.isDirectory();
    },

    isFile: function (fd) {
        const stat = fs.statSync(fd);
        return stat && stat.isFile();
    },

    mkDir: function (dir) {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
    },

    listDir: function (dir) {
       return fs.readdirSync(dir);
    },

    existsFile: function (file) {
        return fs.existsSync(file);
    },

    path: function (rootPath, ...paths) {
        let result = rootPath;
        paths.forEach(item => result += (item.startsWith("/") ? item : "/" + item));
        return result;
    },

    safePath: function (rootPath, ...paths) {
        let result = rootPath;

        paths.forEach(item => {
            const tokens = item.split('/');
            tokens.filter(token => token.length !== 0).forEach(token => result += "/" + this.safeName(token));
        });

        return result;
    },

    parentPath: function (path) {
        return path ? putil.dirname(path) : ".";
    },

    readFile: function (file) {
        if (!fs.existsSync(file)) {
            throw "file doesn't exist, " + file;
        }

        var data = fs.readFileSync(file, 'utf-8');
        return file.endsWith(".json") || file.endsWith(".bundle") ? JSON.parse(data) : data;
    },

    readFileBinary: function (file) {
        if (!fs.existsSync(file)) {
            throw "file doesn't exist, " + file;
        }

        return fs.readFileSync(file);
    },

    writeFile: function (file, data) {
        this.mkDir(this.parentPath(file));
        fs.writeFileSync(file, this.pretty(data));
    },

    writeFileBinary: function (file, data) {
        this.mkDir(this.parentPath(file));
        fs.writeFileSync(file, data);
    },

    print: function (data) {
        if (data) console.log(this.pretty(data));
        else console.log();
    },

    log: function (prefix, ...args) {
        let text = prefix;

        if (args[0].length > 0) args[0].forEach(item => text += " " + this.pretty(item));

        console.log(text
            .replaceAll("\\r\\n", "\n")
            .replaceAll("\\n", "\n"));
    },

    error: function (message, ...args) {
        this.log("[error] " + message, args);
    },

    warn: function (message, ...args) {
        if (logLevel >= WARN_LEVEL) this.log("[warn] " + message, args);
    },

    info: function (message, ...args) {
        if (logLevel >= INFO_LEVEL) this.log("[info] " + message, args);
    },

    fine: function (message, ...args) {
        if (logLevel >= FINE_LEVEL) this.log("[fine] " + message, args);
    },

    debug: function (message, ...args) {
        if (logLevel >= DEBUG_LEVEL) this.log("[debug] " + message, args);
    },

    pretty: function (data) {
        return typeof data === 'object' ? JSON.stringify(data, null, 2) : data;
    },

    writeResult: function (file, bundle) {
        if (file) {
            this.info("writing to file " + file);
            this.writeFile(file, bundle);
        } else {
            this.print(bundle);
        }
    },

    writePartsResult: function (dir, parts) {
        parts.forEach(part => {
            if (part.filename) {
                this.info(`writing ${part.name} part to file ${dir}/${part.filename}`);
                this.writeFileBinary(this.path(dir, part.filename), part.data);
            } else {
                this.debug(`ignoring the ${part.name} part`);
            }
        });
    },

    safeName: function (name) {
        return name.replace(/[\/:*?"<>|]/g,"+");
    },

    zeroPad: function (num, places) {
        return num.toString().padStart(places, '0');
    },

    /**
     * register the enabled extensions
     * @param listOrItem one or more enabled extension names
     */
    extensions: function (listOrItem) {
        if (Array.isArray(listOrItem)) {
            listOrItem.forEach(item => extns[item] = {ref: null});
        } else if (listOrItem) {
            extns[listOrItem] = {ref: null};
        }

        return Object.keys(extns);
    },

    /**
     * Load and get the extension
     * @param ref extension name
     * @returns {{apply: function(*): *}}
     */
    extension: function (ref) {
        let extn = extns[ref];
        if (!extn) {
            this.warn(ref + " graphman extension is not enabled, falling back to the default");
            extn = defaultExtn;
        }

        if (!extn.ref) {
            const filename = MODULES_DIR + "/extn/graphman-extension-" + ref + ".js";
            if (this.existsFile(filename)) {
                extn.ref = require("./extn/graphman-extension-" + ref);
            } else {
                this.warn(ref + ` graphman extension file (${filename}) is missing, falling back to the default`);
                extn.ref = defaultExtn.ref;
            }
        }

        return extn.ref;
    },

    mappings: function (actions) {
        const result = {};

        if (actions) {
            this.verifyMappingAction(actions.action);
            result['default'] = {action: actions.action, level: actions.level || '0'};
            delete actions.action;
            delete actions.level;
        } else {
            result['default'] = {action: null, level: '0'};
        }

        Object.keys(actions||{}).forEach(key => {
            this.verifyMappingAction(actions[key].action, key);

            const instr = result[key] = result[key] || {};
            instr.action = actions[key].action || result['default'].action;
            instr.level = actions[key].level || result['default'].level;
        });

        return result;
    },

    verifyMappingAction: function (action, type) {
        if (!action) return;

        switch (action) {
            case "NEW_OR_EXISTING":
            case "NEW_OR_UPDATE":
            case "ALWAYS_CREATE_NEW":
            case "IGNORE":
            case "DELETE":
                return;
        }

        throw "invalid mapping action " + action + (type ? " specified for " + type : "");
    }
}
