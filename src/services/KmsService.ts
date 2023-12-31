import { AwsCredentialIdentityProvider } from '@smithy/types';
import {
  CreateAliasCommand,
  CreateKeyCommand,
  DescribeKeyCommand,
  GetKeyPolicyCommand,
  KeyMetadata,
  KMSClient,
  ListKeysCommand,
  ListAliasesCommand,
  PutKeyPolicyCommand,
} from '@aws-sdk/client-kms';

export class KmsService {
  kmsClient: KMSClient;

  constructor(credentials: AwsCredentialIdentityProvider) {
    this.kmsClient = new KMSClient({ credentials });
  }

  async listKeys() {
    const listKeysCommand = new ListKeysCommand({});
    const Keys = (await this.kmsClient.send(listKeysCommand)).Keys || [];

    const KeysWithAliases = await Promise.all(
      Keys.map(async (key) => {
        const describeKeyCommand = new DescribeKeyCommand({ KeyId: key.KeyId });
        const { KeyMetadata } = await this.kmsClient.send(describeKeyCommand);

        if (KeyMetadata?.PendingDeletionWindowInDays) return;

        const listAliasesCommand = new ListAliasesCommand({ KeyId: key.KeyId });
        const Aliases = (await this.kmsClient.send(listAliasesCommand)).Aliases || [];

        if (!Aliases.length) return;

        return {
          ...key,
          Aliases,
        };
      }),
    );

    return KeysWithAliases.filter((key) => key);
  }

  async createKey(aliasName: string) {
    const createKeyCommand = new CreateKeyCommand({});
    const { KeyMetadata } = await this.kmsClient.send(createKeyCommand);

    const createAliasCommand = new CreateAliasCommand({
      AliasName: aliasName,
      TargetKeyId: KeyMetadata?.KeyId,
    });
    await this.kmsClient.send(createAliasCommand);

    return KeyMetadata;
  }

  async getKeyPolicy(keyMetaData?: KeyMetadata) {
    const getKeyPolicyCommand = new GetKeyPolicyCommand({
      KeyId: keyMetaData?.KeyId,
      PolicyName: 'default',
    });
    const { Policy } = await this.kmsClient.send(getKeyPolicyCommand);

    return Policy;
  }

  async updateKeyPolicy(keyMetaData?: KeyMetadata, policy?: string) {
    const putKeyPolicyCommand = new PutKeyPolicyCommand({
      KeyId: keyMetaData?.KeyId,
      Policy: policy,
      PolicyName: 'default',
    });

    await this.kmsClient.send(putKeyPolicyCommand);
  }
}
