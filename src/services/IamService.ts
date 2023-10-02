import { AwsCredentialIdentityProvider } from '@smithy/types';
import { IAMClient } from '@aws-sdk/client-iam';
import { ListUsersCommand, ListPoliciesCommand, ListAccessKeysCommand } from '@aws-sdk/client-iam';
import { CreateUserCommand, AttachUserPolicyCommand, CreateAccessKeyCommand } from '@aws-sdk/client-iam';
import { User } from '@aws-sdk/client-iam';

export class IamService {
  iamClient: IAMClient;

  constructor(credentials: AwsCredentialIdentityProvider) {
    this.iamClient = new IAMClient({ credentials });
  }

  async getUsers() {
    const listUsersCommand = new ListUsersCommand({});
    const { Users } = await this.iamClient.send(listUsersCommand);

    return Users || [];
  }

  async createUser(userName: string) {
    const createUserCommand = new CreateUserCommand({ UserName: userName });
    const { User } = await this.iamClient.send(createUserCommand);

    return User;
  }

  async getPolicies() {
    const listPoliciesCommand = new ListPoliciesCommand({});
    const { Policies } = await this.iamClient.send(listPoliciesCommand);

    return Policies || [];
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
