const utils = require("./graphman-utils");
const graphman = require("./graphman");
var error = false;
module.exports = {
    run: function (params) {
        if (params.input) {
            const obj = utils.readFile(params.input)
            if (Object.keys(obj).length == 1 && Object.keys(obj)[0] == "All") {
                validateAssertions(Object.values(obj)[0])
                if (!error) {
                    utils.info("validation is successful");
                }
            } else {
                console.log("Given policy is invalid");
            }
        }
    },

    usage: function () {
        console.log("    validate --input <input-file>");
    }
}

function validateAssertions(assertionArray) {
    for (let i = 0; i < assertionArray.length; i++) {
        validateAssertion(assertionArray[i])
        const key = Object.keys(assertionArray[i])[0]
        if (key == "All" || key == "OneOrMore") {
            validateAssertions(Object.values(assertionArray[i])[0])
        }
    }
}

function validateAssertion(assertion) {
    const valid = graphman.policySchema(assertion)
    if (!valid) {
        error = true
        console.log(graphman.policySchema.errors)
    }
}
