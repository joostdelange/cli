import { DescribeOrganizationCommand, DescribeCreateAccountStatusCommand, DescribeAccountCommand } from '@aws-sdk/client-organizations';
import { ListRootsCommand, ListOrganizationalUnitsForParentCommand, ListAccountsCommand, ListParentsCommand } from '@aws-sdk/client-organizations';
import { CreateOrganizationalUnitCommand, CreateAccountCommand } from '@aws-sdk/client-organizations';
import { MoveAccountCommand } from '@aws-sdk/client-organizations';
import { CreateAccountState, AccountStatus } from '@aws-sdk/client-organizations';
import { GetCallerIdentityCommand } from '@aws-sdk/client-sts';
import { OrganizationsClient } from '@aws-sdk/client-organizations';
import { STSClient } from '@aws-sdk/client-sts';
import colors from '@colors/colors';

const organizationsClient = new OrganizationsClient();
const stsClient = new STSClient();

export async function getOrganization() {
  const describeOrganizationCommand = new DescribeOrganizationCommand({});
  try {
    const { Organization } = await organizationsClient.send(describeOrganizationCommand);

    return Organization;
  } catch (e) {
    return {};
  }
}

export async function getOrganizationRoot() {
  const listRootsCommand = new ListRootsCommand({});
  const { Roots } = await organizationsClient.send(listRootsCommand);
  const [root] = Roots || [];

  return root;
}

export async function getAllOrganizationalUnits(parentId?: string) {
  const listOrganizationalUnitsForParentCommand = new ListOrganizationalUnitsForParentCommand({ ParentId: parentId });
  const { OrganizationalUnits } = await organizationsClient.send(listOrganizationalUnitsForParentCommand);

  return OrganizationalUnits || [];
}

export async function createOrganizationalUnit(name: string, parentId: string) {
  const createOrganizationalUnitCommand = new CreateOrganizationalUnitCommand({ Name: name, ParentId: parentId });
  const { OrganizationalUnit } = await organizationsClient.send(createOrganizationalUnitCommand);

  return OrganizationalUnit;
}

export async function getAllAccounts() {
  const listAccountsCommand = new ListAccountsCommand({});
  const { Accounts } = await organizationsClient.send(listAccountsCommand);

  const getCallerIdentityCommand = new GetCallerIdentityCommand({});
  const callerIdentity = await stsClient.send(getCallerIdentityCommand);

  return Accounts
    .filter((item) => item.Status === AccountStatus.ACTIVE)
    .filter((item) => item.Id !== callerIdentity.Account);
}

export async function getParentOrganizationalUnit(id: string) {
  const listParentsCommand = new ListParentsCommand({ ChildId: id });
  const { Parents } = await organizationsClient.send(listParentsCommand);
  const [parent] = Parents || [];

  return parent || {};
}

export async function createAccount(name: string, email: string, organizationRootId: string, organizationalUnitId: string) {
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
