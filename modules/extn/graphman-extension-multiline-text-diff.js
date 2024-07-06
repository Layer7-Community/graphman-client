
const diffExtn = require('diff');

module.exports = {
    /**
     * Extension to compute multiline text differences.
     * diff operation uses this extension for capturing the policy code differences.
     * @param input simple difference data
     * @param input.path json path to the field that has difference
     * @param input.source source entity field's value
     * @param input.target target entity field's value
     */
    apply: function (input) {
        if (input.path.endsWith(".policy.xml") || input.path.endsWith(".policy.json") || input.path.endsWith(".policy.yaml")) {
            input.diff = diffExtn.createTwoFilesPatch("target", "source", input.target, input.source);
            input.diff = input.diff.split("\n");
        }

        return input;
    }
}
