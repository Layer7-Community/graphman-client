const utils = require("./graphman-utils");
const policySchema = require("./policy-schema");

var error = false;
module.exports = {
    schemaValidator: null,
    run: function (params) {
        if (params.input) {
            buildPolicySchema()
            const obj = utils.readFile(params.input)
            if (Object.keys(obj).length == 1 && Object.keys(obj)[0] == "All") {
                validateAssertions(Object.values(obj)[0])
                if (!error) {
                    utils.info("validation is successful");
                }
            } else {
                utils.info("Given policy is invalid");
            }
        }
    },

    usage: function () {
        utils.print("    validate --input <input-file>");
    }
}
function buildPolicySchema(){
    this.schemaValidator = policySchema.build();
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
    const valid = this.schemaValidator(assertion)
    if (!valid) {
        error = true
        utils.print(this.schemaValidator.errors)
    }
}
