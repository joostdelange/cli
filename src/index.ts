#!/usr/bin/env node
import { Command } from 'commander';
import { createOrganizationAccount } from './createOrganizationAccount.js';

const program = new Command();

program
  .name('automation-scripts')

program
  .command('create-organization-account')
  .action(createOrganizationAccount);

program.parse();
