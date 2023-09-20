import { AwsCredentialIdentityProvider } from '@smithy/types';
import { KMSClient } from '@aws-sdk/client-kms';
import { CreateKeyCommand, DescribeKeyCommand, CreateAliasCommand, GetKeyPolicyCommand, PutKeyPolicyCommand } from '@aws-sdk/client-kms';
import { KeyMetadata } from '@aws-sdk/client-kms';

export class KmsService {
  kmsClient: KMSClient;

  constructor(credentials: AwsCredentialIdentityProvider) {
    this.kmsClient = new KMSClient({ credentials });
  }

  async createKey(aliasName: string) {
    const createKeyCommand = new CreateKeyCommand({});
    const { KeyMetadata } = await this.kmsClient.send(createKeyCommand);

    const createAliasCommand = new CreateAliasCommand({
      AliasName: aliasName,
      TargetKeyId: KeyMetadata.KeyId,
    });
    await this.kmsClient.send(createAliasCommand);

    return KeyMetadata;
  }

  async getKeyPolicy(keyMetaData: KeyMetadata) {
    const getKeyPolicyCommand = new GetKeyPolicyCommand({
      KeyId: keyMetaData.KeyId,
      PolicyName: 'default',
    });
    const { Policy } = await this.kmsClient.send(getKeyPolicyCommand);

    return Policy;
  }

  async updateKeyPolicy(keyMetaData: KeyMetadata, policy: string) {
    const putKeyPolicyCommand = new PutKeyPolicyCommand({
      KeyId: keyMetaData.KeyId,
      Policy: policy,
      PolicyName: 'default',
    });

    await this.kmsClient.send(putKeyPolicyCommand);
  }
}
