# Graphman client

Graphman is an API running on a Layer7 Gateway for interacting with the gateway configuration. This API
lets you retrieve full or partial gateway configuration from a Layer7 Gateway with Graphman running on it,
bundle configuration for the purposes of applying configuration as code and apply configuration to a
gateway.

Graphman is a GraphQL API but you don't need prior experience with, or an understanding of GraphQL to use it
with this client. This client abstracts out the GraphQL API layer by providing commands to perform common
Graphman operations. Power users can dive into the GraphQL layer to create their own queries that can then be
used with this client. Custom GraphQL queries let you control the specific configuration that needs to be
bundled for your domain-specific use case. To help dive into that layer, power users should refer to the 
provided Postman collection which provides samples for all the queries and mutations supported by Graphman.

# Jump to
1. [Using in Postman](#postman)
2. [Getting Started with the Command-line (CLI)](#cli)
3. [Graphman bundles explained](#bundles)

# Graphman client CLI

## Getting Started with the CLI <a name="cli"></a>

To get started with the command line interface, you need to have node.js installed on your system. You can
check that you have node installed by running this command:
```
node -v
```

If node is not already installed on your system, you can download it from https://nodejs.org/en/download/.
Minimum version that is expected to work with is 16.+.

Next, set the environmental variable **GRAPHMAN_HOME** to the path where this packaged is installed. For
example:
```
export GRAPHMAN_HOME=~/dev/mygraphmanclient
```
> [!TIP]
> Make sure adding the node and graphman client paths to the **PATH** environment variable so that client can be used from any directory workspace.

Then, you configure the one or more gateway profiles (under _gateways_ section) to interact with by editing the _**graphman.configuration**_ file. 
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
> 
You are now ready to start using Graphman. 

To bundle the entire configuration of the gateway, run the
following command:
```
./graphman.sh export --gateway source-gateway --using all --output mybundle.json
```

You can apply this configuration bundle as-is to the target gateway.
```
./graphman.sh import --gateway target-gateway --input mybundle.json
```

Congratulations, you just packaged all the configuration from the source gateway, and applied it to the
target gateway.

> [!TIP]
> Use platform specific entrypoint to interact with the GRAPHMAN. 
> 
> - Windows - graphman.bat
> 
> - Linux - graphman.sh

> [!TIP]
> Running GRAPHMAN with no arguments lists the supported operations and shows how to get started. 
 
You can get more information about every operation by specifying the _--help_ parameter.
```
./graphman.sh <operation> --help
```

To know about client itself, now use the _**version**_ operation
```
./graphman.sh version
```

> [!WARNING]
> Graphman is still under continuous development to extend its support to the gateway entities. 
> As GraphQL schema is subjected to the frequent modifications, new or modified queries may not be compatible with the older gateways. 
> 
> 
> Supported schema(s):
> - v11.1.00
>
> Use the older clients (https://github.com/Layer7-Community/graphman-client/releases) to work with the earlier schemas.

## Graphman configuration bundles <a name="bundles"></a>

Graphman bundles are collections of 0 or more Layer7 Gateway configuration entities. You can combine any
entities together, no matter their type. Here is an example bundle containing a cluster-wide property and 
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
./graphman.sh explode --input mybundle.json --output mybundle-exploded
```

This will create a directory structure under the _mybundle-exploded_ directory, which contains each configuration entity in its own
file. 

> [!TIP] Use level of explosion to separate binary data or code from the entity configuration
> > --options.level 1 to explode cert or key binary data into separate files
> 
> > --options.level 2 to explode policy code into separate files


You manipulate the configuration in this directory structure directly (changing JSON file properties, 
delete some files, copy others, etc) and repackage it as a single bundle JSON by doing this reverse command.

```
./graphman.sh implode --input mybundle-exploded --output mynewbundle.json
```

## Using the Graphman export command

The Graphman export command lets you create a bundle for specific entities based on a query targetting those
entities. The **queries** folder contains a number of sample queries that can be used for this purpose. The query
to use is provided to the command using the --using option. Here are some examples and how to use them.

### all

This query lets you package the entire configuration of a gateway. No input parameters are needed for this
one:
```
./graphman.sh export --gateway source-gateway --using all --output mybundle.json
```

### folder
This sample query packages a combination of all policies and services
 that are at a specific folder path location as well as in children sub-folders.

To export all policies and services from a folder _/hello/world_ and all its sub-folders:
```
./graphman.sh export --gateway source-gateway --using folder --variables.folderPath /hello/world --output hello-world.json
```

### service
This query lets you package a particular published service from the source gateway. You identify which service to pull by providing the command the
resolution path defined for this service.

To export a service with the _/hello-world_ resolution path:
```
./graphman.sh export --gateway source-gateway --using service --variables.resolutionPath /hello-world --output hello-world.json
```

### encass
This query lets you package a particular encapsulated assertion from the source gateway. To export an encapsulated assertion with the _hello-world_ name:
```
./graphman.sh export --gateway source-gateway --using encass --variables.name hello-world --output hello-world.json
```

### policy
This query lets you package a particular policy from the source gateway. To export a policy with the _hello-world_ name:
```
./graphman.sh export --gateway source-gateway --using policy --variables.name hello-world --output hello-world.json
```

> [!TIP]
> To include the dependencies while using above queries, choose either of the below option
>
> using the query suffix
>> <folder|service|encass|policy>**:full**
>
> using the additional parameter
>> _--variables.includeAllDependencies true_

> [!NOTE]
> Sometimes, complex query execution might get aborted due to the limits imposed for protection.
> Please adjust the allowed query max depth and complexity using the gateway's system properties.
> For more information, please check the system properties section of the [graphman](https://techdocs.broadcom.com/us/en/ca-enterprise-software/layer7-api-management/api-gateway/11-1/apis-and-toolkits/graphman-management-api.html) page.
> 
### General using queries and creating your own queries
The folder 'queries' contains other queries you can use. Each query is defined in a .gql file and corresponding
.json files to wrap the query and its variables. You will notice some of the .gql files contain raw graphql
syntax (such as the example policy.gql) whereas others leverage a metadata mechanism that
centralizes the definition of which properties to use per entity type.

You can add your own queries by creating your own combo
.gql and .json files. The .gql can contain any GraphQL syntax that you paste from Postman for example.

## Using the Graphman import command

Use this command to import a specified gateway configuration bundle to a target gateway.

```
./graphman.sh import --gateway target-gateway --input hello-world.json
```
You can specify the policy revision comment when you import bundles.
```
./graphman.sh import --gateway target-gateway --input hello-world.json --options.comment "hellow-world patch v1.2.34"
```
It is recommended to install/delete bundles using the standard bundle operations. 
Standard mutation operations cover all the supported entity types and take care of their mutations in their order of dependency. 
Of course, the default mutation-based query is **install-bundle**.
```
./graphman.sh import --gateway target-gateway --using install-bundle --input hello-world.json
```
```
./graphman.sh import --gateway target-gateway --using delete-bundle --input hello-world.json
```

By default, mutation action is NEW_OR_UPDATE. You can override this using _--bundleDefaultAction_ option.
```
./graphman.sh import --gateway target-gateway --input hello-world.json --options.bundleDefaultAction NEW_OR_EXISTING
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
./graphman.sh import --gateway target-gateway --using delete-bundle --input hello-world.json --options.mappings.action DELETE --options.mappings.keys.action IGNORE --options.mappings.trustedCerts.action IGNORE
```

## Using the Graphman mappings command
Sometimes, we may require greater level of control over the bundle mutations. For which, one can take advantage of the mappings to specify the mutation actions at the entity level.
mappings command helps us to generate the mapping instructions with fine level of control. 

Generate mapping instructions at the bundled entity level.
```
./graphman.sh mappings --input hello-world.json --mappings.action NEW_OR_EXISTING --mappings.level 2
```

Generate entity level mapping instructions for services alone 
```
./graphman.sh mappings --input hello-world.json --mappings.action NEW_OR_EXISTING --mappings.services.level 2
```

Generate mapping instructions for multiple entity classes
```
./graphman.sh mappings --input hello-world.json --mappings.services.action NEW_OR_EXISTING --mappings.services.level 2 --mappings.encassConfigs.action IGNORE
```

## Using the Graphman diff command

To compare the configuration between the gateways or bundles, you can diff them using graphman.

```
./graphman.sh diff --input bundle1.json --input @some-gateway
```

The output of diff includes the difference for entities and a mapping of goid conflicts.

### Bundle the difference between two gateways

Graphman helps you bundle the delta between two gateways.

You can use the difference between two gateways to produce a configuration bundle that contains
this difference. You can use these bundles to bring up to date a target gateway based on its 
differences with a source gateway.

```
./graphman.sh diff --renew --output deltaBundle.json
```

### Subtracting a bundle from another

You can also use this client to subtract from a first bundle, the entities that exist in
a second bundle.

Why would you need to do this? For example, you want to remove an overlap between a framework
type configuration from a service and all its dependencies (e.g. you end up with unwanted OTK
config entities in a bundle). To perform this operation, use the diff command:
```
./graphman.sh diff --input tooBig.json --input whatToCut.json --output trimmed.json
```

If you wish to subtract entities from whatToCut.json even if they are different from tooBig.json
you can remove from checksum property in whatToCut.json. For example if whatToCut.json contains:

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

Then the subtract command will always remove the default ssl key and default listednPorts no matter their
value in the source.


## Using the Graphman combine command

You can combine two configuration bundles using the combine command:
```
./graphman.sh combine --input bundle1.bundle --input bundle2.bundle--output full.bundle
```

## Using the Graphman revise command

Revises the specified bundle using the target gateway. This operation is useful when 
the specified bundle has goid/guid references that are out of sync with respect to the 
target gateway.
```
./graphman.sh revise --input some-bundle.bundle --output renewed-bundle.bundle
```

## Using the Graphman renew command

Renews the specified bundle using the source gateway. This operation is useful when 
the specified bundle is outdated or incomplete.  
```
./graphman.sh renew --input some-bundle.bundle --output renewed-bundle.bundle
```

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
Policy code can be represented in newer formats i.e., JSON and YAML. By default, it will be in XML. Client can be configured to work with these newer formats.
Use _policyCodeFormat_ global option to choose one of these formats. Exploding the bundle with level 2 makes the policy code separate from the usual configuration when needed. 
When the policy code is authored outside the Layer7, it can be validated using the below operation.
```
./graphman.sh validate --input mybundle.json
```
> [!NOTE]
> This operation requires third-party node package i.e., [ajv json schema validator](https://www.npmjs.com/package/ajv).
>
# Global options
Client can be configured at global level to deal with certain configuration details. Use the **_options_** section of _graphman.configuration_ file
- **log**: log level for the client. Permitted values are _nolog_, _warn_, _info_, _fine_, _debug_.  
- **policyCodeFormat**: Policy code is now represented in multiple formats (_xml_, _json_, _yaml_). Use this option to choose one of it.
- **keyFormat**: Key data can be managed in both _p12_ and _pem_ formats. Use this option to choose either of the one.

# Deprecated entity types
As part of extending the supportability and standardization, few of the existing entity types and their associated query-level field methods are deprecated. It is recommended to start using the latest GraphQL types in favour of extensibility and support.
|Deprecated entity type| Use new GraphQL 
- _webApiServices_, use **_services_** instead
- _soapServices_, use **_services_** instead
- _internalWebApiServices_, use **_services_** instead
- _internalSoapServices_, use **_services_** instead
- _policyFragments_, use **_policies_** instead
- _fips_, use **_federatedIdps_** instead
- _ldaps_, use **_ldapIdps_** instead
- _fipUsers_, use **_federatedUsers_** instead
- _fipGroups_, use **_federatedGroups_** instead

