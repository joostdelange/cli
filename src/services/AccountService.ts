import { AwsCredentialIdentityProvider } from '@smithy/types';
import { AccountClient } from '@aws-sdk/client-account';
import { ListRegionsCommand } from '@aws-sdk/client-account';
import { RegionOptStatus } from '@aws-sdk/client-account';

export class AccountService {
  accountClient: AccountClient;

  constructor(credentials: AwsCredentialIdentityProvider) {
    this.accountClient = new AccountClient({ credentials });
  }

  async listRegions() {
    const listRegionsCommand = new ListRegionsCommand({
      RegionOptStatusContains: [RegionOptStatus.ENABLED, RegionOptStatus.ENABLED_BY_DEFAULT],
      MaxResults: 50,
    });
    const { Regions } = await this.accountClient.send(listRegionsCommand);

    return Regions;
  }
}
