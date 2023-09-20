#!/usr/bin/env node
import { Command } from 'commander';
import { onExit } from 'signal-exit';
import { setupOrganizationAccount } from './actions/setupOrganizationAccount.js';

onExit(() => process.exit());

const program = new Command('joostdelange-cli');

program.alias('jcli');

program.command('setup-organization-account').action(setupOrganizationAccount);

program.parse();
