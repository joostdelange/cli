#!/usr/bin/env node
import { Command } from 'commander';
import { onExit } from 'signal-exit';
import { OrganizationsPrompt } from './prompts/OrganizationsPrompt.ts';
import { DatabasePrompt } from './prompts/DatabasePrompt.ts';

onExit(() => process.exit());

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
  .description('Use the subcommands below to use this one');

program.option('-h, --host <host>', 'Host of the new connection');
program.option('-p, --port <port>', 'Port that should be used');
program.option('-u, --username <username>', 'Username of the new connection');
program.option('-d, --database <database>', 'Name of the database that should be used');
program.option('-n, --name <name>', 'Friendly (unique) name for the connection');

databaseCommand
  .command('create-connection')
  .description('Create a new connection')
  .action(() => {
    databasePrompt.createConnection();
  });

databaseCommand
  .command('delete-connection')
  .description('Delete a previously created connection')
  .action(() => {
    databasePrompt.deleteConnection();
  });

program.parse();
