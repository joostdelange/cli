import { AwsCredentialIdentityProvider } from '@smithy/types';
import { IAMClient } from '@aws-sdk/client-iam';
import { ListPoliciesCommand } from '@aws-sdk/client-iam';
import { CreateUserCommand, AttachUserPolicyCommand, CreateAccessKeyCommand } from '@aws-sdk/client-iam';
import { User } from '@aws-sdk/client-iam';

export async function createUser(credentials: AwsCredentialIdentityProvider, userName: string) {
  const iamClient = new IAMClient({ credentials });
  const createUserCommand = new CreateUserCommand({ UserName: userName });
  const { User } = await iamClient.send(createUserCommand);

  return User;
}

export async function getPolicies(credentials: AwsCredentialIdentityProvider) {
  const iamClient = new IAMClient({ credentials });
  const listPoliciesCommand = new ListPoliciesCommand({});
  const { Policies } = await iamClient.send(listPoliciesCommand);

  return Policies;
}

export async function attachUserPolicies(credentials: AwsCredentialIdentityProvider, user: User, policyArns: string[]) {
  const iamClient = new IAMClient({ credentials });
  
  for await (const policyArn of policyArns) {
    const attachUserPolicyCommand = new AttachUserPolicyCommand({
      UserName: user.UserName,
      PolicyArn: policyArn,
    });
  
    await iamClient.send(attachUserPolicyCommand);
  }
}

export async function createUserAccessKey(credentials: AwsCredentialIdentityProvider, user: User) {
  const iamClient = new IAMClient({ credentials });
  const createAccessKeyCommand = new CreateAccessKeyCommand({ UserName: user.UserName });
  const { AccessKey } = await iamClient.send(createAccessKeyCommand);

  return AccessKey;
}
