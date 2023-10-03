import {
  Account,
  AccountStatus,
  CreateAccountCommand,
  CreateAccountState,
  CreateOrganizationalUnitCommand,
  DescribeAccountCommand,
  DescribeCreateAccountStatusCommand,
  DescribeOrganizationCommand,
  ListParentsCommand,
  ListRootsCommand,
  MoveAccountCommand,
  OrganizationalUnit,
  OrganizationsClient,
  paginateListOrganizationalUnitsForParent,
  paginateListAccounts,
} from '@aws-sdk/client-organizations';
import { GetCallerIdentityCommand } from '@aws-sdk/client-sts';
import { STSClient } from '@aws-sdk/client-sts';
import colors from '@colors/colors';

export class OrganizationsService {
  organizationsClient: OrganizationsClient;
  stsClient: STSClient;

  constructor() {
    this.organizationsClient = new OrganizationsClient();
    this.stsClient = new STSClient();
  }

  async getOrganization() {
    const describeOrganizationCommand = new DescribeOrganizationCommand({});
    try {
      const { Organization } = await this.organizationsClient.send(describeOrganizationCommand);

      return Organization;
    } catch (e) {
      return {};
    }
  }

  async getOrganizationRoot() {
    const listRootsCommand = new ListRootsCommand({});
    const { Roots } = await this.organizationsClient.send(listRootsCommand);
    const [root] = Roots || [];

    return root;
  }

  async getAllOrganizationalUnits(parentId?: string) {
    const paginator = paginateListOrganizationalUnitsForParent(
      {
        client: this.organizationsClient,
        pageSize: 20,
      },
      {
        ParentId: parentId,
      },
    );
    const organizationalUnits: OrganizationalUnit[] = [];

    for await (const page of paginator) {
      organizationalUnits.push(...(page.OrganizationalUnits || []));
    }

    return organizationalUnits;
  }

  async createOrganizationalUnit(name: string, parentId?: string) {
    const createOrganizationalUnitCommand = new CreateOrganizationalUnitCommand({ Name: name, ParentId: parentId });
    const { OrganizationalUnit } = await this.organizationsClient.send(createOrganizationalUnitCommand);

    return OrganizationalUnit;
  }

  async getAllAccounts() {
    const accounts: Account[] = [];
    const paginator = paginateListAccounts({ client: this.organizationsClient, pageSize: 20 }, {});

    for await (const page of paginator) {
      accounts.push(...(page.Accounts || []));
    }

    const getCallerIdentityCommand = new GetCallerIdentityCommand({});
    const callerIdentity = await this.stsClient.send(getCallerIdentityCommand);

    return (
      accounts
        .filter((item) => item.Status === AccountStatus.ACTIVE)
        .filter((item) => item.Id !== callerIdentity.Account) || []
    );
  }

  async getParentOrganizationalUnit(id?: string) {
    const listParentsCommand = new ListParentsCommand({ ChildId: id });
    const { Parents } = await this.organizationsClient.send(listParentsCommand);
    const [parent] = Parents || [];

    return parent || {};
  }

  async createAccount(name: string, email: string, organizationRootId?: string, organizationalUnitId?: string) {
    const createAccountCommand = new CreateAccountCommand({
      AccountName: name,
      Email: email,
    });
    let { CreateAccountStatus } = await this.organizationsClient.send(createAccountCommand);

    while (CreateAccountStatus?.State === CreateAccountState.IN_PROGRESS) {
      const describeCreateAccountStatusCommand = new DescribeCreateAccountStatusCommand({
        CreateAccountRequestId: CreateAccountStatus.Id,
      });
      CreateAccountStatus = (await this.organizationsClient.send(describeCreateAccountStatusCommand))
        .CreateAccountStatus;

      await new Promise((resolve) => setTimeout(() => resolve('sleep'), 2000));
    }

    if (CreateAccountStatus?.State === CreateAccountState.FAILED) {
      console.error(
        colors.red(`⚠  Account creation failed with failure reason: ${CreateAccountStatus.FailureReason}`),
      );

      return;
    }

    const moveAccountCommand = new MoveAccountCommand({
      AccountId: CreateAccountStatus?.AccountId,
      SourceParentId: organizationRootId,
      DestinationParentId: organizationalUnitId,
    });
    await this.organizationsClient.send(moveAccountCommand);

    const describeAccountCommand = new DescribeAccountCommand({
      AccountId: CreateAccountStatus?.AccountId,
    });
    const { Account } = await this.organizationsClient.send(describeAccountCommand);

    return Account;
  }
}
