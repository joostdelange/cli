import colors from '@colors/colors';
import { Ora } from 'ora';
import { Root, OrganizationalUnit, Account } from '@aws-sdk/client-organizations';
import { input, select, Separator } from '@inquirer/prompts';
import { getParentOrganizationalUnit, createOrganizationalUnit } from '../services/organizations.js';
import { createAccount } from '../services/organizations.js';

export class OrganizationsPrompt {
  accounts: Account[];
  organizationRoot: Root;
  organizationalUnits: OrganizationalUnit[];
  spinner: Ora;

  constructor(organizationRoot: Root, organizationalUnits: OrganizationalUnit[], accounts: Account[], spinner: Ora) {
    this.organizationRoot = organizationRoot;
    this.organizationalUnits = organizationalUnits;
    this.accounts = accounts;
    this.spinner = spinner;
  }

  async run() {
    const selectedAccountId = await select({
      message: 'Which account should be used?',
      choices: [
        { value: undefined, name: colors.underline('Create a new acount') },
        new Separator(colors.grey(!this.organizationalUnits.length ? 'There are no existing accounts' : 'Accounts')),
        ...this.accounts.map((account) => ({ value: account.Id, name: account.Name })),
      ],
    });

    let account: Account = {};
    let parentOrganizationalUnit: OrganizationalUnit = {};

    if (selectedAccountId) {
      account = this.accounts.find((item) => item.Id === selectedAccountId);
  
      const parent = await getParentOrganizationalUnit(account.Id);
      parentOrganizationalUnit = this.organizationalUnits.find((item) => item.Id === parent.Id);
    } else {
      const selectedParentOrganizationalUnitId = await select({
        message: 'What should be the parent organizational unit of the account?',
        choices: [
          { value: undefined, name: colors.underline('Create a new organizational unit') },
          new Separator(colors.grey(!this.organizationalUnits.length ? 'There are no existing organizational units' : 'Organizational units')),
          ...this.organizationalUnits.map((organizationalUnit) => ({ value: organizationalUnit.Id, name: organizationalUnit.Name })),
        ],
      });

      if (selectedParentOrganizationalUnitId) {
        parentOrganizationalUnit = this.organizationalUnits.find((item) => item.Id === selectedParentOrganizationalUnitId);
      } else {
        const parentOrganizationalUnitName = await input({ message: 'Name of the new parent organizational unit' });

        this.spinner.start(`Creating new organizational unit '${parentOrganizationalUnitName}'`);
        parentOrganizationalUnit = await createOrganizationalUnit(parentOrganizationalUnitName, this.organizationRoot.Id);
        this.spinner.stop();
      }

      const accountName = await input({ message: `Name of the new account to be placed under organizational unit '${parentOrganizationalUnit.Name}'` });
      const accountEmail = await input({ message: 'And what about the email address?' });

      this.spinner.start(`Creating new account '${accountName}'`);
      account = await createAccount(accountName, accountEmail, this.organizationRoot.Id, parentOrganizationalUnit.Id);
      this.spinner.stop();
    }

    return { account, parentOrganizationalUnit };
  }
}
