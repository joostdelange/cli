import { OrganizationalUnit, Account } from '@aws-sdk/client-organizations';
import { input, select, Separator } from '@inquirer/prompts';
import colors from '@colors/colors';
import ora from 'ora';
import { getOrganization, getOrganizationRoot, getAllOrganizationalUnits, getParentOrganizationalUnit, createOrganizationalUnit } from '../services/organizations.js';
import { getAllAccounts, createAccount } from '../services/organizations.js';
import { getTemporaryCredentials } from '../services/credentialProvider.js';
import { ResourceActionsPrompt } from '../prompts/ResourceActionsPrompt.js';

const spinner = ora();

export async function setupOrganizationAccount() {
  spinner.start('Fetching organization');
  const [organization, organizationRoot] = await Promise.all([getOrganization(), getOrganizationRoot()]);

  if (!organization.Id) {
    spinner.stop();
    console.error(colors.red('⚠  No organization found'));

    return;
  }

  spinner.text = 'Fetching existing organizational units';
  let organizationalUnits = await getAllOrganizationalUnits(organizationRoot.Id);

  spinner.text = 'Fetching existing accounts';
  const accounts = await getAllAccounts();

  spinner.stop();

  const selectedAccountId = await select({
    message: 'Which account should be used?',
    choices: [
      { value: undefined, name: colors.underline('Create a new acount') },
      new Separator(colors.grey(!organizationalUnits.length ? 'There are no existing accounts' : 'Accounts')),
      ...accounts.map((account) => ({ value: account.Id, name: account.Name })),
    ],
  });

  let account: Account = {};
  let parentOrganizationalUnit: OrganizationalUnit = {};

  if (selectedAccountId) {
    account = accounts.find((item) => item.Id === selectedAccountId);

    const parent = await getParentOrganizationalUnit(account.Id);
    parentOrganizationalUnit = organizationalUnits.find((item) => item.Id === parent.Id);
  } else {
    const selectedParentOrganizationalUnitId = await select({
      message: 'What should be the parent organizational unit of the account?',
      choices: [
        { value: undefined, name: colors.underline('Create a new organizational unit') },
        new Separator(colors.grey(!organizationalUnits.length ? 'There are no existing organizational units' : 'Organizational units')),
        ...organizationalUnits.map((organizationalUnit) => ({ value: organizationalUnit.Id, name: organizationalUnit.Name })),
      ],
    });
  
    if (selectedParentOrganizationalUnitId) {
      parentOrganizationalUnit = organizationalUnits.find((item) => item.Id === selectedParentOrganizationalUnitId);
    } else {
      const parentOrganizationalUnitName = await input({ message: 'Name of the new parent organizational unit' });
  
      spinner.start(`Creating new organizational unit '${parentOrganizationalUnitName}'`);
      parentOrganizationalUnit = await createOrganizationalUnit(parentOrganizationalUnitName, organizationRoot.Id);
      spinner.stop();
    }

    const accountName = await input({ message: `Name of the new account to be placed under organizational unit '${parentOrganizationalUnit.Name}'` });
    const accountEmail = await input({ message: 'And what about the email address?' });

    spinner.start(`Creating new account '${accountName}'`);
    account = await createAccount(accountName, accountEmail, organizationRoot.Id, parentOrganizationalUnit.Id);
    spinner.stop();
  }

  const credentials = getTemporaryCredentials(account.Id);
  const resourceActionsPrompt = new ResourceActionsPrompt(credentials);

  await resourceActionsPrompt.run();
}
