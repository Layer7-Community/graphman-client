
const util = require("./util");
const {expectArrayObject} = util;
test('read clusterProperties', () => {
    const output = util.graphman("export", "--using", "clusterProperties");
    expectArrayObject(output.clusterProperties)
        .shouldContain([{name: 'greetings', value: 'Hello, World!'}]);
});
