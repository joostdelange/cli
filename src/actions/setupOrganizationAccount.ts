import colors from '@colors/colors';
import ora from 'ora';
import { getOrganization, getOrganizationRoot, getAllOrganizationalUnits, getParentOrganizationalUnit, createOrganizationalUnit } from '../services/organizations.js';
import { getAllAccounts } from '../services/organizations.js';
import { getTemporaryCredentials } from '../services/credentialProvider.js';
import { ResourceActionsPrompt } from '../prompts/ResourceActionsPrompt.js';
import { OrganizationsPrompt } from '../prompts/OrganizationsPrompt.js';

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
  const organizationalUnits = await getAllOrganizationalUnits(organizationRoot.Id);

  spinner.text = 'Fetching existing accounts';
  const accounts = await getAllAccounts();

  spinner.stop();

  const organizationsPrompt = new OrganizationsPrompt(organizationRoot, organizationalUnits, accounts, spinner);
  const { account } = await organizationsPrompt.run();

  const credentials = getTemporaryCredentials(account.Id);

  const resourceActionsPrompt = new ResourceActionsPrompt(credentials, spinner);
  await resourceActionsPrompt.run();
}
