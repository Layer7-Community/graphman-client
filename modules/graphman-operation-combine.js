
const utils = require("./graphman-utils");
const butils = require("./graphman-bundle");

module.exports = {
    /**
     * Combines two or more bundles into one.
     * @param params
     * @param params.input tow or more input bundle file(s)
     */
    run: function (params) {
        if (!params.input) {
            throw "--input parameters are missing";
        }

        if (!Array.isArray(params.input) || params.input.length < 2) {
            throw "not enough input bundles, operation requires at least two bundles";
        }

        let resultBundle = utils.readFile(params.input[0]);
        params.input.slice(1).forEach(item => {
            utils.info("processing " + item);
            const bundle = utils.readFile(item);
            resultBundle = combine(resultBundle, bundle);
        });

        utils.writeResult(params.output, butils.sort(resultBundle));
    },

    initParams: function (params, config) {
        // do nothing
        return params;
    },

    usage: function () {
        console.log("combine --input <input-file> --input <input-file> [--input <input-file>,...]");
        console.log("  [--output <output-file>]");
        console.log();
        console.log("Combines two or more bundles into one.");
        console.log("When similar entities are encountered, entities from the rightmost bundle takes the precedence.");
        console.log();
        console.log("  --input <input-file>");
        console.log("    specify two or more input bundles file(s)");
        console.log();
        console.log("  --output <output-file>");
        console.log("    specify the file to capture the combined gateway configuration as bundle");
        console.log();

    }
}

function combine(left, right) { // right takes the precedence
    const result = {};

    Object.keys(left).forEach(key => {
        result[key] = right[key] || left[key];

        if (Array.isArray(left[key])) {
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
        if (Array.isArray(result[key]) && result[key].length === 0) {
            delete result[key];
        }
    });

    return result;
}
