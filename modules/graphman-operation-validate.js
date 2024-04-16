const utils = require("./graphman-utils");
const graphman = require("./graphman");

module.exports = {
    run: function (params) {
        if (params.input) {
            const obj = utils.readFile(params.input)
            if (Object.keys(obj)[0] == "All") {
                validateJson(Object.values(obj)[0])
                if (!graphman.policySchema.errors) {
                    utils.info("validation is successful");
                }
            } else {
                console.log("Invalid policy");
            }
        }
    },

    usage: function () {
        console.log("    validate --input <input-file>");
    }
}

function validateJson(allArray) {
    for (let i = 0; i < allArray.length; i++) {
        const key = Object.keys(allArray[i])[0]
        if (key == "All" || key == "OneOrMore") {
            validateAssertion(allArray[i])
            validateJson(Object.values(allArray[i])[0])
        } else {
            validateAssertion(allArray[i])
        }
    }
}

function validateAssertion(assertion) {
    const valid = graphman.policySchema(assertion)
    if (!valid) {
        console.log(graphman.policySchema.errors)
    }
}
