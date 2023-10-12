# @joostdelange/cli

CLI with useful commands I use frequently
## Installation

Install @joostdelange/cli with pnpm

```console
$ pnpm install @joostdelange/cli
$ joost help
```

## Aliases

- joost
- j (if not occupied)
## Commands

```console
$ joost setup-organization-account
Choose or create an AWS organization account and add some useful resources in it

$ joost database [action]
Use one of the sub-commands to manage connections and other useful database-related stuff

$ joost database create-connection
Create a new database connection and save it to the local config

$ joost database delete-connection
Delete an existing database connection from the local config

$ joost database create-select-query
Create SELECT query based on a single table from a previously created database connection
```

