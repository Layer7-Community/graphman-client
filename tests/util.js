
const fs = require('fs');
const cp = require('child_process');

let execFile = "graphman.bat";
let wspace = "build/tests";

module.exports = {
    config: function (cfg) {
        if (cfg.exec) execFile = cfg.exec;
        if (cfg.wspace) wspace = cfg.wspace;
    },

    graphman: function (...args) {
        const outputFile = wspace + "/output.json";

        args.push("--output");
        args.push(outputFile);

        if (fs.existsSync(outputFile)) fs.unlinkSync(outputFile);
        cp.execFileSync(execFile, args);

        return JSON.parse(fs.readFileSync(outputFile));
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
