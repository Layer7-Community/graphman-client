
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

        fs.unlinkSync(outputFile);
        cp.execFileSync(execFile, args);

        return JSON.parse(fs.readFileSync(outputFile));
    },

    expectArrayObject: function(obj) {
        return {
            shouldContain: function (items) {
                let expectItems = items.map(item => expect.objectContaining(item));
                expect(obj).toEqual(expect.arrayContaining(expectItems));
            }
        };
    },
    
    readFileAsJson: function (path) {
        return JSON.parse(fs.readFileSync(path));
    }
};
