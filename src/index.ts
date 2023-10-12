#!/usr/bin/env node
import { Command } from 'commander';
import { OrganizationsPrompt } from './prompts/OrganizationsPrompt.ts';
import { DatabasePrompt } from './prompts/DatabasePrompt.ts';

const program = new Command('joost');

const organizationsPrompt = new OrganizationsPrompt(program);
const databasePrompt = new DatabasePrompt(program);

program.alias('j');

program
  .command('setup-organization-account')
  .description('Choose or create an AWS organization account and add some useful resources in it')
  .action(() => {
    organizationsPrompt.run();
  });

const databaseCommand = program
  .command('database')
  .alias('db')
  .description('Use one of the sub-commands to manage connections and other useful database-related stuff');

program.option('-h, --host <host>', 'Host of the new connection');
program.option('-p, --port <port>', 'Port that should be used');
program.option('-u, --username <username>', 'Username of the new connection');
program.option('-d, --database <database>', 'Name of the database that should be used');
program.option('-n, --name <name>', 'Friendly (unique) name for the connection');

databaseCommand
  .command('create-connection')
  .description('Create a new database connection and save it to the local config')
  .action(() => {
    databasePrompt.createConnection();
  });

databaseCommand
  .command('delete-connection')
  .description('Delete an existing database connection from the local config')
  .action(() => {
    databasePrompt.deleteConnection();
  });

program.option('-n, --connection-name <connectionName>', 'The name of an existing connection');

databaseCommand
  .command('create-select-query')
  .alias('create-select')
  .description('Create SELECT query based on a single table from a previously created database connection')
  .action(() => {
    databasePrompt.createSelectQuery();
  });

program.parse();
