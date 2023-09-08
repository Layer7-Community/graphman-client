
const utils = require("./graphman-utils");
const butils = require("./graphman-bundle");

module.exports = {
    run: function (params) {
        if (!params.input) {
            throw "Missing --input parameters";
        }

        if (!Array.isArray(params.input) || params.input.length < 2) {
            throw "Not enough input bundles, operation requires at least two bundles";
        }

        let resultBundle = utils.readFile(params.input[0]);
        params.input.slice(1).forEach(item => {
            utils.info("processing " + item);
            const bundle = utils.readFile(item);
            resultBundle = combine(resultBundle, bundle);
        });

        utils.writeResult(params.output, butils.sort(resultBundle));
    },

    usage: function () {
        console.log("    combine --input <input-file> [--input <input-file>,...] [--output <output-file>]");
        console.log("        # when similar entities are found, entities from the rightmost bundle takes the precedence.");
    }
}

function combine(left, right) { // right takes the precedence
    const result = {};

    Object.keys(left).forEach(key => {
        result[key] = right[key] || left[key];

        if (left[key]) {
            left[key].forEach(item => {
                if (!butils.findMatchingEntity(result[key], item)) {
                    result[key].push(item);
                }
            })
        }
    });

    Object.keys(right).forEach(key => {
        if (!result[key]) result[key] = right[key];
    });

    Object.keys(result).forEach(key => {
        if (result[key].length === 0) {
            delete result[key];
        }
    });

    return result;
}
