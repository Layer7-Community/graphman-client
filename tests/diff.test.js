/*
 * Copyright ©  2024. Broadcom Inc. and/or its subsidiaries. All Rights Reserved.
 */

const tUtils = require("./utils");
const {graphman} = tUtils;

test("generate diff bundle using existing report", () => {
    const output = graphman("diff",
        "--input-report", "diff-report.sample.json");
});

