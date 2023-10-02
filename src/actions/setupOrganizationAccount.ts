import colors from '@colors/colors';
import ora from 'ora';
import { OrganizationsService } from '../services/OrganizationsService.js';
import { CredentialProviderService } from '../services/CredentialProviderService.js';
import { ResourceActionsPrompt } from '../prompts/ResourceActionsPrompt.js';
import { OrganizationsPrompt } from '../prompts/OrganizationsPrompt.js';

const spinner = ora();
const organizationsService = new OrganizationsService();
const credentialProviderService = new CredentialProviderService();

export async function setupOrganizationAccount() {
  spinner.start('Fetching organization');
  const [organization, organizationRoot] = await Promise.all([
    organizationsService.getOrganization(),
    organizationsService.getOrganizationRoot(),
  ]);

  if (!organization?.Id) {
    spinner.stop();
    console.error(colors.red('⚠  No organization found'));

    return;
  }

  spinner.text = 'Fetching existing organizational units';
  const organizationalUnits = await organizationsService.getAllOrganizationalUnits(organizationRoot.Id);

  spinner.text = 'Fetching existing accounts';
  const accounts = await organizationsService.getAllAccounts();

  spinner.stop();

  const organizationsPrompt = new OrganizationsPrompt(organizationRoot, organizationalUnits, accounts, spinner);
  const { account } = await organizationsPrompt.run();

  if (!account?.Id) {
    console.error(colors.red('⚠  No account found'));

    return;
  }

  const credentials = credentialProviderService.getTemporaryCredentials(account.Id);

  const resourceActionsPrompt = new ResourceActionsPrompt(credentials, spinner);
  await resourceActionsPrompt.run();
}
