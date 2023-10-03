#!/usr/bin/env node
import { Command } from 'commander';
import { onExit } from 'signal-exit';
import { setupOrganizationAccount } from './actions/setupOrganizationAccount.js';

onExit(() => process.exit());

const program = new Command('joost');

program.alias('j');

program
  .command('setup-organization-account')
  .description('Choose or create an AWS organization account and add some useful resources in it')
  .action(setupOrganizationAccount);

program.parse();
