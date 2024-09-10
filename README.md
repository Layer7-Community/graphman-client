# Graphman Client

Graphman Client is a stand-alone, [node.js](https://nodejs.org/en/about) based command-line tool for interacting with the Graphman API.

Graphman is an API running on a Layer7 Gateway for interacting with the gateway configuration. This API
lets you retrieve full or partial gateway configuration as a bundle for the purposes of applying configuration as code and apply configuration to a
gateway.

Graphman is a GraphQL API, but you don't need prior experience with, or an understanding of GraphQL to use it
with this client. This client abstracts out the GraphQL API layer by providing commands to perform common
Graphman operations. Power users can dive into the GraphQL layer to create their own queries that can then be
used with this client. Custom GraphQL queries let you control the specific configuration that needs to be
bundled for your domain-specific use case. To help dive into that layer, power users should refer to the 
provided Postman collection which provides samples for all the queries and mutations supported by Graphman.

# Jump to
1. [Getting Started](#cli)
2. [Graphman bundles explained](#bundles)
3. [Compatibility Matrix](#compatibility-matrix)
4. [Using in Postman](#postman)

## Getting Started <a name="cli"></a>

To get started with the command line interface, you need to have [node.js](https://nodejs.org/en/about) installed on your system. You can
check that you have node installed by running this command:
```
node -v
```

If node is not already installed on your system, you can download it from https://nodejs.org/en/download/.
Minimum version that is expected to work with is 16.+.

### Install the graphman client from Broadcom's npm registry
- install the client directly from the registry
  - `npm install @layer7/graphman --global --registry https://packages.broadcom.com/artifactory/api/npm/layer7-npm`
- verify the installation by running the version command
  - `graphman version`
- choose some directory to keep the custom queries, extensions and configuration files and set the **GRAPHMAN_HOME** environment variable to it.
  - `export GRAPHMAN_HOME=/path/to/layer7-graphman-home`

> [!NOTE] 
> As the module is installed globally, graphman client can be executed from any directory workspace. And, no extension is needed to refer it.

> [!NOTE]
> Please refer the [Previous Releases'](docs/previous-releases.md) page for installing the older clients

### Update the graphman client from registry
- installed client (from Broadcom's registry) can be updated to the latest available.
  - `npm update @layer7/graphman --global --registry https://packages.broadcom.com/artifactory/api/npm/layer7-npm`
- in case if you want to update the client to a particular release, specify release version.
  - `npm update @layer7/graphman@<some-release-version> --global --registry https://packages.broadcom.com/artifactory/api/npm/layer7-npm`
- verify the update by running the version command
  - `graphman version`

> [!NOTE]
> npm-update is not applicable if the existing client was not installed from the registry. You must uninstall it and continue installing it from registry.

### Uninstall the graphman client
- starting from 1.3.* releases, client should be uninstalled using npm.
  - `npm uninstall @layer7/graphman --global`
- in particular to the 1.3.00 release, cd to the home directory and run the npm-uninstall command.
  - `npm uninstall @layer7/graphman`
- remove the client's home directory path from the PATH environment variable
- delete the client's home directory itself
  
Then, you may configure one or more gateway profiles (under _gateways_ section) to interact with by editing the _**graphman.configuration**_ file. 
Choose one of the gateway profile as part of _--gateway_ parameter while working with CLI. When this parameter is omitted, it will be defaulted to the **_default_** gateway profile.
```
{
    "gateways": {
        "default": {
            "address": "https://localhost:8443/graphman",
            "username": "admin",
            "password": "7layer",
            "rejectUnauthorized": false,
            "keyFilename": null,  /* key for mTLS based authentication */
            "certFilename": null,  /* cert for mTLS based authentication */
            "passphrase": "7layer",
            "allowMutations": false  /* true to allow mutations */
        }
    },

    "options": {
        "log": "info",
        "policyCodeFormat": "xml",
        "keyFormat": "p12"
    }
}
```
> [!NOTE]
> mTLS based authentication takes the precedence over the password-based authentication.

> [!NOTE]
> In order to protect the gateways from the accidental mutations, by default, mutation based queries are disallowed. You must enable them by setting the _allowMutations_ field of the gateway profile to _true_.
> It is recommended to set this value to false in the profile, and override it from the CLI arguments (`--gateways.<profile>.allowMutations`).
> 
You are now ready to start using Graphman. 

To bundle the entire configuration of the gateway, run the
following command:
```
graphman.sh export --gateway <source-gateway> --using all --output source-bundle.json
```

You can apply this configuration bundle as-is to the target gateway.
```
graphman.sh import --gateway <target-gateway> --input source-bundle.json
```

Congratulations, you just packaged all the configuration from the source gateway, and applied it to the
target gateway.

> [!TIP]
> Running GRAPHMAN with no arguments lists the supported operations and shows how to get started. 
 
You can get more information about every operation by specifying the _--help_ parameter.
```
graphman.sh <operation> --help
```

To know about client itself, now use the _**version**_ operation
```
graphman.sh version
```

> [!WARNING]
> Graphman is still under continuous development to extend its support to the gateway entities. 
> As GraphQL schema is subjected to the frequent modifications, new or modified queries may not be compatible with the older gateways. 
> 

> Supported schema(s) (i.e., version of the Layer7 API Gateway)
- v11.1.1 (default)
- v11.1.00
- v11.0.00-CR03

> Switch to the one of the above supported schemas using CLI argument (`--options.schema <schema>`) 

> Use the older clients (https://github.com/Layer7-Community/graphman-client/releases) to work with the earlier schemas.

## Compatibility Matrix <a name="compatibility-matrix"></a>
The following table describes the compatibility of the Graphman client with the targeting Layer7 API Gateways.

| Graphman Client | Layer7 API Gateway               |
|-----------------|----------------------------------|
| v1.3.*          | v11.1.1, v11.1.00, v11.0.00-CR03 |
| v1.2.*          | v11.1.00                         |
| v1.1            | v10.1 CR04, v11.0 CR02           |
| v1.0.*          | v10.1 CR03, v11.0 CR01           |


## Graphman configuration bundles <a name="bundles"></a>

Graphman bundles are collections of zero or more Layer7 Gateway configuration entities. You can combine any
entities together, no matter their type. They are always grouped into sections (entity types). Here is an example bundle containing a cluster-wide property and 
a jdbc connection:

```
{
  "clusterProperties": [
    {
      "goid": "e0440d109ed4d6f931cefd84b506c962"
      "name": "some-cluster-property",
      "checksum": "e0aa4e7fb2a69405c8aec3e242a8f7c99e4c9a76",
      "description": "a custom property",
      "hiddenProperty": false,
      "value": "hello"
    }
  ],
  "jdbcConnections": [
    {
      "goid": "915f526e3a756f8d16eaff3058a25613"
      "name": "mydb",
      "checksum": "15059c05def480b53e4a0b022da2b23e3881c500",
      "enabled": true,
      "driverClass": "com.l7tech.jdbc.mysql.MySQLDriver",
      "jdbcUrl": "jdbc://mydb/mydb",
      "username": "hello",
      "password": "${secpass.mydb.plaintext}",
      "minPoolSize": 3,
      "maxPoolSize": 15,
      "properties": [
        {
          "name": "EnableCancelTimeout",
          "value": "true"
        }
      ]
    }
  ]
}
```

### Single JSON bundle vs exploded configuration
Graphman configuration bundles are exported as JSON files but also have an 'exploded' representation where
each configuration entity is separated in its own individual JSON file organized in a folder structure.

To create an 'exploded' representation of a Graphman bundle, use this command:
```
graphman.sh explode --input mybundle.json --output mybundle-exploded
```

This will create a directory structure under the _mybundle-exploded_ directory, which contains each configuration entity in its own
file. 

> [!TIP]
> Use level of explosion to separate binary data or code from the entity configuration
>> --options.level 1 to explode cert, key and wsdl resources into separate files
> 
>> --options.level 2 to explode policy code into separate files


You manipulate the configuration in this directory structure directly (changing JSON file properties, 
delete some files, copy others, etc) and repackage it as a single bundle JSON by doing this reverse command.

```
graphman.sh implode --input mybundle-exploded --output mynewbundle.json
```

## Using export command

The Graphman export command lets you create a bundle for specific entities based on a query targetting those
entities. The **queries** folder contains a number of sample queries that can be used for this purpose. The query
to use is provided to the command using the `--using` argument. Here are some examples and how to use them.

### all

This query lets you package the entire configuration of a gateway. No input parameters are needed for this
one:
```
graphman.sh export --gateway <source-gateway> --using all --output mybundle.json
```
- specify `--options.policyCodeFormat <format>` to choose one of the supported policy code formats (`xml|json|yaml|code`) for export
- specify `--options.keyFormat <format>` to choose one of the supported key formats (`p12|pem`) for export
- use `--options.includePolicyRevisions` flag to include policy revisions along with the **policies** and **services** for export
- use `--options.includeMultipartFields` flag to include multipart fields (filePartName) so that server module file will be fully exported
- NOTE: Above options are applicable to the **export** operation irrespective of the query being used.

### all:summary
This query lets you know the summary of the entire gateway configuration. One of the main use of this is to quickly identify what is missing or modified. FYI, **diff** operation uses this query.
```
graphman.sh export --gateway <source-gateway> --using all:summary --output mybundle.json
```

### folder
This sample query packages a combination of all policies and services
 that are at a specific folder path location as well as in children sub-folders.

To export all policies and services from a folder _/hello/world_ and all its sub-folders:
```
graphman.sh export --gateway <source-gateway> --using folder --variables.folderPath /hello/world --output hello-world.json
```

### service
This query lets you package a particular published service from the source gateway. You identify which service to pull by providing the command the
resolution path defined for this service.

To export a service with the _/hello-world_ resolution path:
```
graphman.sh export --gateway <source-gateway> --using service --variables.resolutionPath /hello-world --output hello-world.json
```

### encass
This query lets you package a particular encapsulated assertion from the source gateway. To export an encapsulated assertion with the _hello-world_ name:
```
graphman.sh export --gateway <source-gateway> --using encass --variables.name hello-world --output hello-world.json
```

### policy
This query lets you package a particular policy from the source gateway. To export a policy with the _hello-world_ name:
```
graphman.sh export --gateway <source-gateway> --using policy --variables.name hello-world --output hello-world.json
```

> [!TIP]
> To include the dependencies while using above queries, choose either of the below option
>
> using the query suffix
>> `<folder|service|encass|policy>:full`
>
> using the additional parameter
>> `--variables.includeAllDependencies`

> [!NOTE]
> Sometimes, complex query execution might get aborted due to the limits imposed for protection.
> Please adjust the allowed query max depth and complexity using the gateway's system properties.
> For more information, please check the system properties section of the [graphman](https://techdocs.broadcom.com/us/en/ca-enterprise-software/layer7-api-management/api-gateway/11-1/apis-and-toolkits/graphman-management-api.html) page.
> 
### Get to know about the in-built queries
Every field level method defined in the schema can be used for querying the gateway configuration.
For example, you can export a policy by guid as the schema defines `policyByGuid` field method.
```
graphman.sh export --gateway <source-gateway> --using policyByGuid --variables.guid <guid>
```

Please refer to the **describe** command how to discover the available queries.

### Creating your own queries
The folder **queries** contains other queries you can use. Each query is defined in a .gql file and corresponding
.json files to wrap the query and its variables. You will notice some of the .gql files contain raw graphql
syntax (such as the example policy.gql) whereas others leverage a metadata mechanism that
centralizes the definition of which properties to use per entity type.

You can add your own queries by creating your own combo
.gql and .json files. The .gql can contain any GraphQL syntax that you paste from Postman for example.

For example, let's create a customized query to export all the internal services.
- create two files in the **queries** folder with a common name as **internal-services**.
- internal-services.json 
  ```
  {
    "query": "{{internal-services.gql}}",
    "variables": {}
  }
  ```
- internal-services.gql
  ```
  query internalServices($includeSoap: Boolean = false) {
    servicesByType1: servicesByType(serviceType: INTERNAL_SOAP) @include(if: $includeSoap) {
      goid
      guid
      name
      resolutionPath
      checksum
    }
    servicesByType2: servicesByType(serviceType: INTERNAL_WEB_API) {
      goid
      guid
      name
      resolutionPath
      checksum
    }
  }
  ```
- Now, try using it at **export** command
  - `graphman.sh export --using internal-services`
  - `graphman.sh export --using internal-services --variables.includeSoap`
- When you want to specify all the fields, there's an alternative way of describing the fields for simplicity. You just need to specify the GraphQL entity type name so that it will be expanded to the fields.
  - internal-services.gql
  ```
  query internalServices($includeSoap: Boolean = false) {
    servicesByType1: servicesByType(serviceType: INTERNAL_SOAP) @include(if: $includeSoap) {
      {{L7Service}}
    }
    servicesByType2: servicesByType(serviceType: INTERNAL_WEB_API) {
      {{L7Service}}
    }
  }
  ```

## Using schema command
This command let you know the available GraphQL entity types. 

```
graphman.sh schema
```

Output from the command is useful to know about the supported GraphQL entity types. For example, cluster properties are one of the gateway configuration entities. 
- `ClusterProperty` is the GraphQL entity type, whereas `clusterProperties` is the reference name.
- GraphQL type names are used in writing queries. These names are in PascalCasing, singular form.
- Whereas, reference names are used in bundles and CLI arguments. These names are in CamelCasing, plural form. 
- Bundle groups the similar entities by their type, in which these reference names are used to refer the group. 


## Using describe command
Use this command to discover the available queries and their arguments.

Below command displays all the available queries
```
graphman.sh describe
```

Use --query argument with wild-card pattern to look for the interested queries
```
graphman.sh describe --query service*
```

Use --query argument with a specific query name to get to know more about it
```
graphman.sh describe --query serviceByResolversAndRevision
```

## Using import command
Use this command to import a specified gateway configuration bundle to a target gateway.

```
graphman.sh import --gateway <target-gateway> --input hello-world.json
```
You can specify the policy revision comment when you import bundles.
```
graphman.sh import --gateway <target-gateway> --input hello-world.json --options.comment "hellow-world patch v1.2.34"
```
It is recommended to install/delete bundles using the standard bundle operations. 
Standard mutation operations cover all the supported entity types and take care of their mutations in their order of dependency. 
Of course, the default mutation-based query is **install-bundle**.
```
graphman.sh import --gateway <target-gateway> --using install-bundle --input hello-world.json
```
```
graphman.sh import --gateway <target-gateway> --using delete-bundle --input hello-world.json
```

By default, mutation action is NEW_OR_UPDATE. You can override this using _--bundleDefaultAction_ option.
```
graphman.sh import --gateway <target-gateway> --input hello-world.json --options.bundleDefaultAction NEW_OR_EXISTING
```

> [!NOTE]
> Permitted entity mapping actions are:
> - NEW_OR_UPDATE
> - NEW_OR_EXISTING
> - ALWAYS_CREATE_NEW
> - DELETE
> - IGNORE

You can override mutation actions if exists using _--mappings_ option. For example, delete a bundle excluding the keys and trustedCerts.
```
graphman.sh import --gateway <target-gateway> --using delete-bundle --input hello-world.json --options.mappings.action DELETE --options.mappings.keys.action IGNORE --options.mappings.trustedCerts.action IGNORE
```

In case if you are interested to migrate policies and services along with their revisions, try importing the bundle with the revisions with the `migratePolicyRevisions` option.
```
graphman.sh import --gateway <target-gateway> --input hello-world-with-policy-revisions.json --options.migratePolicyRevisions
```

## Using mappings command
Sometimes, we may require greater level of control over the bundle mutations. For which, one can take advantage of the mappings to specify the mutation actions at the entity level.
mappings command helps us to generate the mapping instructions with fine level of control. 

Generate mapping instructions at the bundled entity level.
```
graphman.sh mappings --input hello-world.json --mappings.action NEW_OR_EXISTING --mappings.level 2
```

Generate entity level mapping instructions for services alone 
```
graphman.sh mappings --input hello-world.json --mappings.action NEW_OR_EXISTING --mappings.services.level 2
```

Generate mapping instructions for multiple entity classes
```
graphman.sh mappings --input hello-world.json --mappings.services.action NEW_OR_EXISTING --mappings.services.level 2 --mappings.encassConfigs.action IGNORE
```

## Using diff command

To compare the configuration between the gateways or bundles, you can diff them using graphman.
```
graphman.sh diff --input-source bundle1.json --input-target bundle2.json --output delta.json
```

The output of diff includes the difference for entities and a mapping of goid conflicts. More precisely, what is to be applied to the **target** to match it with the **source**. 
By default, missing entities and modified entities will be included into the delta. You may choose to remove the extra entities from the **target**  by `--options.includeDeletes` option.
```
graphman.sh diff --input-source bundle1.json --input-target bundle2.json --output delta.json --options.includeDeletes
```

> [!NOTE]
> Use '@' prefix to the input parameter for treating it as gateway profile name. 
> Otherwise, it will be considered as bundle file.

### Bundle the delta between two gateways

Graphman helps you bundle the delta between two gateways.

You can use the difference between two gateways to produce a configuration bundle that contains
this difference. You can use these bundles to bring up to date a **target** gateway based on its 
differences with a **source** gateway.

```
graphman.sh diff --input-source @<source-gateway> --input-target @<target-gateway> --output delta.json
```

As the diff command uses the summary bundle for identifying the differences between gateways, resultant delta bundle is loaded with the partial entity details, hence it is not import ready. So, either we should be instructing the diff command to renew the delta entities using the **source** gateway or renew them separately.
```
graphman.sh diff --input-source @<source-gateway> --input-target @<target-gateway> --output delta.json --options.renewEntities
  (or)
graphman.sh renew --input delta.json --gateway <source-gateway> --output delta-renewed.json  
```

Once the differences are identified with full entity details, delta bundle is import ready. After successful import, the **target** environment should be matching with that of the **source** gateway.

### Report about the differences
Sometimes, you might be curious to observe the differences closely. For which, diff command can be instructed to capture the report.
```
graphman.sh diff --input-source bundle1.json --input-target bundle2.json --output delta.json --output-report delta-report.json
```

This report organizes the differences in 4 categories.
- inserts
  - entities from this category are entirely missing from the **target** environment.
- updates
  - entities from this category are different by one or more fields.
- deletes
  - entities from this category exist with the **target** environment, but missing from the **source**. In other words, they can be seen as unwanted entities, hence they are deletable.
- diffs
  - this category exemplifies the **updates** section such that what portion of the entity is different. All the differences are captured at the entity property level as a linear list.
  - For example:
    ```
      "diffs": {
        "services": [
        {
          "resolutionPath": "/some-service",
          "serviceType": "WEB_API",
          "details": [
            {
              "path": "$.checksum",
              "source": "0413eafd68e5b2cc5bd1a0fe6f5bacca861146c3",
              "target": "534c3f33415a355bdd36328ddcc454635c73c9b7"
            },
            {
              "path": "$.tracingEnabled",
              "source": true,
              "target": false
            },
            {
              "path": "$.wssProcessingEnabled",
              "source": true,
              "target": false
            },
            {
              "path": "$.properties[0].value",
              "source": "Hello World!",
              "target": "Hello!"
            }
          ]
        }
      ]
    }
    ```

### Subtracting a bundle from another

You can also use this client to subtract from a first bundle, the entities that exist in
a second bundle.

Why would you need to do this? For example, you want to remove an overlap between a framework
type configuration from a service and all its dependencies (e.g. you end up with unwanted OTK
config entities in a bundle). To perform this operation, use the diff command:
```
graphman.sh diff --input-source big-bundle.json --input-target what-to-cut.json --output trimmed.json
```

If you wish to subtract entities from what-to-cut.json even if they are different from big-bundle.json
you can remove from checksum property in what-to-cut.json. For example if what-to-cut.json contains:

```
{
    "keys": [
        {
            "alias": "ssl"
        }
    ],
    "listenPorts": [
        {
            "name": "Default HTTP (8080)"
        },
        {
            "name": "Default HTTPS (8443)"
        },
        {
            "name": "Default HTTPS (9443)"
        },
        {
            "name": "Node HTTPS (2124)"
        }
    ]
}
```

Then the subtract command will always remove the default ssl key and default listenPorts no matter their
value in the source.

## Using combine command
You can combine two configuration bundles using the combine command:
```
graphman.sh combine --inputs bundle1.json bundle2.json --output full.json
```

## Using slice command
You can slice the existing bundle by specifying one or more sections of it.
```
graphman.sh slice --input some-bundle.json  --sections services policies --output sliced-bundle.json
```
Because of the `--sections` argument, only the services and policies will be sliced as a result bundle.

## Using renew command
Renews the specified bundle using the gateway. This operation is useful when
the specified bundle is outdated or incomplete.
```
graphman.sh renew --gateway <some-gateway> --input some-bundle.json --output renewed-bundle.json
```
This operation can be scoped down to one or more sections of the bundle using `--sections` argument.
```
graphman.sh renew --gateway <some-gateway> --input some-bundle.json --sections clusterProperties secrets jdbcConnections
```

## Using revise command
Revises the bundle as per the options. This operation is useful 
- when 
the specified bundle has goid/guid references that are out of sync with respect to the 
target gateway.
- when the specified bundle is defined with the deprecated entity types.
```
graphman.sh revise --input some-bundle.json --output revised-bundle.json
```

# Dealing with secrets in the gateway configuration

Of all the entity types, two of them contain sensitive information which is never in clear:
- Keys (Keystore entries used for example by listeners)
- Secrets (Secure Passwords and SSH keys)

A encryption passphrase provided by the graphman requester is used to encrypt and decrypt these secrets. This
encryption passphrase is set with HTTP header name `l7-passphrase`. If missing, graphman will use its local master
passphrase to encrypt/decrypt these secrets. When using the utils .sh scripts provided, the encryption passphrase
is read from the local target.properties.

For a bundle to be importable on target, provide the same encryption passphrase when applying the bundle as was used
during the creation of the bundle.

The secret portion of the Key entity type is a .p12 (PKCS12) which is protected using the encryption passphrase.
The secret portion of the exported Secret entity type is AES encrypted (but with proprietary key generation method) using the same encryption passphrase and can be
re-encrypted for modification using this standard openssl command
```
> echo  | openssl enc -e -aes-256-cbc -md sha256 -pass pass: -a
```

# Policy as code
Policy code can be represented in newer formats i.e., **_json_** and **_yaml_**. By default, it will be in **_xml_**. Client can be configured to work with these newer formats.
Use _policyCodeFormat_ global option to choose one of these formats. Exploding the bundle with level **2** makes the policy code separate from the usual configuration when needed. 
When the policy code is authored outside the Layer7, it can be validated using the below operation.
```
graphman.sh validate --input mybundle.json
```
> [!NOTE]
> This operation requires third-party node package i.e., [ajv json schema validator](https://www.npmjs.com/package/ajv).
>
# Global options
Client can be configured at global level to deal with certain configuration details. Use the **_options_** section of _graphman.configuration_ file
- **log**: log level for the client. Permitted values are _nolog_, _warn_, _info_, _fine_, _debug_.  
- **policyCodeFormat**: Policy code is now represented in multiple formats (_xml_, _json_, _yaml_). Use this option to choose one of it.
- **keyFormat**: Key data can be managed in both _p12_ and _pem_ formats. Use this option to choose either of the one.

> [!NOTE]
> Global options from the configuration file can be overridden using the CLI argument (`--options.<name> <value>`). 

# Extensions
Graphman Client introduces few extension points that are open to change. So that, user can extend the existing functionality (especially by loading the third-party modules).
By default, not all the extensions are enabled for use. Needed extensions can be enabled either by configuration file or using `--options.extensions` CLI argument.

For example:
`--options.extensions multiline-text-diff policy-code-validator`

- pre-request
  - enables the extension to modify the graphman service request (http). 
  - commands (like **export**, **import**, **renew**, etc) that require interactions with the graphman service use it.
  - ref: _modules/graphman-extension-pre-request.js_
- post-export
  - enables the extension to act on the exported configuration prior to writing it the console or file. 
  - **export** command uses it.
  - ref: _modules/graphman-extension-post-export.js_
- pre-import
  - enables the extension to act on the input prior to submitting it for import.
  - **import** command uses it.
  - ref: _modules/graphman-extension-pre-import.js_
- multiline-text-diff
  - enables the extension to compute the line level differences for the multiline text.
  - **diff** command uses it.
  - ref: _modules/graphman-extension-multiline-text-diff.js_
  - default implementation uses the [diff](https://www.npmjs.com/package/diff) third-party module. By default, it is not enabled for use. 
  - once enabled, make sure this package is installed, available for use
    - `npm install diff@5.2.0 --global`
- policy-code-validator
  - enables the extensions to compile the json schema that is needed for policy code validation. 
  - **validate** command uses it.
  - ref: _modules/graphman-extension-policy-code-validator.js_
  - default implementation uses the [ajv](https://www.npmjs.com/package/ajv) third-party module. By default, it is not enabled for use.
  - once enabled, make sure this package is installed, available for use
  - `npm install ajv --global`

> [!NOTE]
> When the extensions are customized and configured to load from the home directory, their third-party packages might not get loaded.     
This can be resolved by installing them local to the home directory (i.e., repeat npm-install for the third-party packages without --global option).

# Deprecated entity types
As part of extending the supportability and standardization, few of the existing entity types and their associated query-level field methods are deprecated. 
It is recommended to start using the latest GraphQL types in favour of extensibility and support.

| Deprecated entity type   | New entity type                   |
|--------------------------|-----------------------------------|
| _webApiServices_         | use **_services_** instead        |
| _soapServices_           | use **_services_** instead        |
| _internalWebApiServices_ | use **_services_** instead        |
| _internalSoapServices_   | use **_services_** instead        |
| _policyFragments_        | use **_policies_** instead        |
| _globalPolicies_         | use **_policies_** instead        |
| _backgroundTaskPolicies_ | use **_policies_** instead        |
| _fips_                   | use **_federatedIdps_** instead   |
| _fipUsers_               | use **_federatedUsers_** instead  |
| _fipGroups_              | use **_federatedGroups_** instead |
| _ldaps_                  | use **_ldapIdps_** instead        |

> [!NOTE]
> Bundles with the deprecated entity types can be revised using the **revise** operation.
> 
> Previous support for LDAP-based IDP configurations is partial, hence it is recommended to re-export them again.
>

# Using Graphman in Postman <a name="postman"></a>
Use the collection provided in this package by importing it in Postman. Once in Postman, select
the root node of the Collection and open the documentation to get started. Assign two placeholder
variables {{source_gw}} and {{target_gw}} to point to your gateways as well as the admin credentials
as illustrated below.

![The postman collection's root node](img/postman2.png "Collection root")

The Postman collection contains sample Graphman requests organized in categories:
- Bundles and migration - samples showing how to create and apply samples according to different bundling strategies
- Config entities - For each entity types, how to create, read, update, delete (CRUD) those entities
- Summary and compare - Queries that compare various aspect of configuration between two gateways

Each request can be use as-is and has its own documentation.
![A postman sample request with documentation](img/postman1.png "Documentation for each sample")

Some folders contain multiple requests that work together via environment variables and are meant to be used sequentially.
For example under Bundle and Migration, a graphql query creates a graphman bundle which is then used as input in a graphql mutation.

You can create your own folder and copy/paste sample graphman requests into it to create your own configuration flow.

