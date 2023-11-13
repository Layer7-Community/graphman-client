
const util = require("./util");
const {expectArray} = util;
test('read clusterProperties', () => {
    const output = util.graphman("export", "--using", "clusterProperties");
    expectArray(output.clusterProperties)
        .toContainEqual(
            {name: 'cluster.hostname', value: 'ssg101.broadcom.net'},
            {name: 'keyStore.defaultSsl.alias', value: '00000000000000000000000000000002:ssl'});
});
