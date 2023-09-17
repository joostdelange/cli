import { OrganizationsClient } from '@aws-sdk/client-organizations';
import { DescribeOrganizationCommand, DescribeCreateAccountStatusCommand, DescribeAccountCommand } from '@aws-sdk/client-organizations';
import { ListRootsCommand, ListOrganizationalUnitsForParentCommand } from '@aws-sdk/client-organizations';
import { CreateOrganizationalUnitCommand, CreateAccountCommand } from '@aws-sdk/client-organizations';
import { MoveAccountCommand } from '@aws-sdk/client-organizations';
import { OrganizationalUnit, CreateAccountState } from '@aws-sdk/client-organizations';
import { STSClient } from '@aws-sdk/client-sts';
import { input, select, Separator } from '@inquirer/prompts';
import colors from '@colors/colors';
import ora from 'ora';

const organizationsClient = new OrganizationsClient();
const stsClient = new STSClient();
const spinner = ora();

export async function createOrganizationAccount() {
  spinner.start('Fetching organization');
  const [organization, organizationRoot] = await Promise.all([getOrganization(), getOrganizationRoot()]);

  if (!organization.Id) {
    spinner.stop();
    console.error(colors.red('⚠  No organization found'));

    return;
  }

  spinner.text = 'Fetching existing organizational units';
  const organizationalUnits = await getAllOrganizationalUnits(organizationRoot.Id);
  spinner.stop();

  const selectedParentOrganizationalUnitId = await select({
    message: 'What should be the parent organizational unit of the account?',
    choices: [
      { value: undefined, name: colors.underline('Create a new organizational unit') },
      new Separator(colors.grey(!organizationalUnits.length ? 'There are no existing organizational units' : 'Organizational units')),
      ...organizationalUnits.map((organizationalUnit) => ({ value: organizationalUnit.Id, name: organizationalUnit.Name })),
    ],
  });

  let parentOrganizationalUnit: OrganizationalUnit = {};

  if (selectedParentOrganizationalUnitId) {
    parentOrganizationalUnit = organizationalUnits.find((organizationalUnit) => organizationalUnit.Id === selectedParentOrganizationalUnitId);
  } else {
    const parentOrganizationalUnitName = await input({ message: 'Name of the new parent organizational unit' });

    spinner.start(`Creating new organizational unit '${parentOrganizationalUnitName}'`);
    parentOrganizationalUnit = await createOrganizationalUnit(parentOrganizationalUnitName, organizationRoot.Id);
    spinner.stop();
  }

  const accountName = await input({ message: `Name of the new account to be placed under organizational unit '${parentOrganizationalUnit.Name}'` });
  const accountEmail = await input({ message: 'And what about the email address?' });

  spinner.start(`Creating new account '${accountName}'`);
  const account = await createAccount(accountName, accountEmail, organizationRoot.Id, parentOrganizationalUnit.Id);
  spinner.stop();

  console.log(JSON.stringify(account, null, 2));
}

async function getOrganization() {
  const describeOrganizationCommand = new DescribeOrganizationCommand({});
  try {
    const { Organization } = await organizationsClient.send(describeOrganizationCommand);

    return Organization;
  } catch (e) {
    return {};
  }
}

async function getOrganizationRoot() {
  const listRootsCommand = new ListRootsCommand({});
  const { Roots } = await organizationsClient.send(listRootsCommand);
  const [root] = Roots || [];

  return root;
}

async function getAllOrganizationalUnits(parentId?: string) {
  const listOrganizationalUnitsForParentCommand = new ListOrganizationalUnitsForParentCommand({ ParentId: parentId });
  const { OrganizationalUnits } = await organizationsClient.send(listOrganizationalUnitsForParentCommand);

  return OrganizationalUnits || [];
}

async function createOrganizationalUnit(name: string, parentId: string) {
  const createOrganizationalUnitCommand = new CreateOrganizationalUnitCommand({ Name: name, ParentId: parentId });
  const { OrganizationalUnit } = await organizationsClient.send(createOrganizationalUnitCommand);

  return OrganizationalUnit;
}

async function createAccount(name: string, email: string, organizationRootId: string, organizationalUnitId: string) {
  const createAccountCommand = new CreateAccountCommand({ AccountName: name, Email: email });
  let { CreateAccountStatus } = await organizationsClient.send(createAccountCommand);

  while (CreateAccountStatus.State === CreateAccountState.IN_PROGRESS) {
    const describeCreateAccountStatusCommand = new DescribeCreateAccountStatusCommand({ CreateAccountRequestId: CreateAccountStatus.Id });
    CreateAccountStatus = (await organizationsClient.send(describeCreateAccountStatusCommand)).CreateAccountStatus;

    await new Promise((resolve) => setTimeout(() => resolve('sleep'), 2000));
  }

  if (CreateAccountStatus.State === CreateAccountState.FAILED) {
    console.error(colors.red(`⚠  Account creation failed with failure reason: ${CreateAccountStatus.FailureReason}`));

    return;
  }

  const moveAccountCommand = new MoveAccountCommand({
    AccountId: CreateAccountStatus.AccountId,
    SourceParentId: organizationRootId,
    DestinationParentId: organizationalUnitId,
  });
  await organizationsClient.send(moveAccountCommand);

  const describeAccountCommand = new DescribeAccountCommand({ AccountId: CreateAccountStatus.AccountId });
  const { Account } = await organizationsClient.send(describeAccountCommand);

  return Account;
}
