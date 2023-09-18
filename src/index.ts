#!/usr/bin/env node
import { Command } from 'commander';
import { onExit } from 'signal-exit';
import { setupOrganizationAccount } from './actions/setupOrganizationAccount.js';

onExit(() => process.exit());

const test = [
  { name: "Jane", id: '1234', pastime: 'Archery' },
  { name: "John", id: '1235', pastime: 'Knitting' },
  { name: "Jess", id: '1236', pastime: 'Fishing' }
];

const program = new Command('joostdelange-cli');

program
  .alias('jcli')
  .command('setup-organization-account')
  .action(setupOrganizationAccount)
  .parse();
