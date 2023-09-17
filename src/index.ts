#!/usr/bin/env node
import { Command } from 'commander';
import { setupOrganizationAccount } from './actions/setupOrganizationAccount.js';

const program = new Command('joostdelange-cli');

program
  .alias('jcli');

program
  .command('setup-organization-account')
  .action(setupOrganizationAccount);

program.parse();
