import { AwsCredentialIdentityProvider } from '@smithy/types';
import {
  AttachUserPolicyCommand,
  CreateAccessKeyCommand,
  CreateUserCommand,
  IAMClient,
  ListAccessKeysCommand,
  paginateListUsers,
  paginateListPolicies,
  Policy,
  User,
} from '@aws-sdk/client-iam';

export class IamService {
  iamClient: IAMClient;

  constructor(credentials: AwsCredentialIdentityProvider) {
    this.iamClient = new IAMClient({ credentials });
  }

  async getUsers() {
    const paginator = paginateListUsers({ client: this.iamClient, pageSize: 20 }, {});
    const users: User[] = [];

    for await (const page of paginator) {
      users.push(...(page.Users || []));
    }

    return users;
  }

  async createUser(userName: string) {
    const createUserCommand = new CreateUserCommand({ UserName: userName });
    const { User } = await this.iamClient.send(createUserCommand);

    return User;
  }

  async getPolicies() {
    const paginator = paginateListPolicies({ client: this.iamClient, pageSize: 20 }, {});
    const policies: Policy[] = [];

    for await (const page of paginator) {
      policies.push(...(page.Policies || []));
    }

    return policies || [];
  }

  async attachUserPolicies(user: User | undefined, policyArns: (string | undefined)[]) {
    for await (const policyArn of policyArns) {
      const attachUserPolicyCommand = new AttachUserPolicyCommand({
        UserName: user?.UserName,
        PolicyArn: policyArn,
      });

      await this.iamClient.send(attachUserPolicyCommand);
    }
  }

  async getUserAccessKeys(user?: User) {
    const listAccessKeysCommand = new ListAccessKeysCommand({
      UserName: user?.UserName,
    });
    const { AccessKeyMetadata } = await this.iamClient.send(listAccessKeysCommand);

    return AccessKeyMetadata;
  }

  async createUserAccessKey(user?: User) {
    const createAccessKeyCommand = new CreateAccessKeyCommand({
      UserName: user?.UserName,
    });
    const { AccessKey } = await this.iamClient.send(createAccessKeyCommand);

    return AccessKey;
  }
}
