import { fromTemporaryCredentials } from '@aws-sdk/credential-providers';

export class CredentialProviderService {
  getTemporaryCredentials(accountId: string) {
    return fromTemporaryCredentials({
      params: {
        RoleArn: `arn:aws:iam::${accountId}:role/OrganizationAccountAccessRole`,
        RoleSessionName: `temp-${accountId}`,
      },
    });
  }
}
