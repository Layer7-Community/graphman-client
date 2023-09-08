
const fs = require("fs");
const putil = require("path");
const HOME_DIR = process.env.GRAPHMAN_HOME;
const MODULES_DIR = HOME_DIR + "/modules";
const QUERIES_DIR = HOME_DIR + "/queries";
const SCHEMA_DIR = HOME_DIR + "/schema";
const SCHEMA_METADATA_BASE_FILE = "metadata-base.json";
const SCHEMA_METADATA_FILE = "metadata.json";

const NONE_LEVEL = 0;
const WARN_LEVEL = 1;
const INFO_LEVEL = 2;
const FINE_LEVEL = 3;
const DEBUG_LEVEL = 10;
let logLevel = INFO_LEVEL;

module.exports = {
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

    schemaDir: function (schemaVersion) {
        if (schemaVersion) {
            const path = this.path(SCHEMA_DIR, schemaVersion);
            return this.existsFile(path) ? path : SCHEMA_DIR;
        }

        return SCHEMA_DIR;
    },

    schemaMetadataBaseFile: function (schemaVersion) {
        return this.path(this.schemaDir(schemaVersion), SCHEMA_METADATA_BASE_FILE);
    },

    schemaMetadataFile: function (schemaVersion) {
        return this.path(this.schemaDir(schemaVersion), SCHEMA_METADATA_FILE);
    },

    queriesDir: function (schemaVersion) {
        if (schemaVersion) {
            const path = this.path(QUERIES_DIR, schemaVersion);
            return this.existsFile(path) ? path : QUERIES_DIR;
        }

        return QUERIES_DIR;
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
        console.log(this.pretty(data));
    },

    log: function (prefix, ...args) {
        let text = prefix;

        if (args[0].length > 0) args[0].forEach(item => text += " " + this.pretty(item));

        console.log(text
            .replaceAll("\\r\\n", "\n")
            .replaceAll("\\n", "\n"));
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

    extension: function (ref) {
        return this.existsFile(MODULES_DIR + "/extn/" + ref + ".js") ? require("./extn/" + ref) : {call: function () {}};
    }
}
