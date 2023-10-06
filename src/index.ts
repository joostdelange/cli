#!/usr/bin/env node
import { Command } from 'commander';
import { onExit } from 'signal-exit';
import { OrganizationsPrompt } from './prompts/OrganizationsPrompt.js';
import { DatabasePrompt } from './prompts/DatabasePrompt.js';

const organizationsPrompt = new OrganizationsPrompt();
const databasePrompt = new DatabasePrompt();

onExit(() => process.exit());

const program = new Command('joost');

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

databaseCommand
  .command('create-connection')
  .description('Create a new connection')
  .action(() => {
    databasePrompt.createConnection();
  });

program.parse();
