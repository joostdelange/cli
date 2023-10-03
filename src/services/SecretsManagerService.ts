import { AwsCredentialIdentityProvider } from '@smithy/types';
import { CreateSecretCommand, SecretsManagerClient } from '@aws-sdk/client-secrets-manager';

export class SecretsManagerService {
  secretsManagerClient: SecretsManagerClient;

  constructor(credentials: AwsCredentialIdentityProvider) {
    this.secretsManagerClient = new SecretsManagerClient({ credentials });
  }

  async createSecret(name: string, kmsKey?: string) {
    const createSecretCommand = new CreateSecretCommand({
      Name: name,
      KmsKeyId: kmsKey,
    });
    const secret = await this.secretsManagerClient.send(createSecretCommand);

    return secret;
  }
}
