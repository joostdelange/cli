import { AwsCredentialIdentityProvider } from '@smithy/types';
import { select, input, confirm, Separator } from '@inquirer/prompts';
import { createUser, attachUserPolicy, createUserAccessKey } from '../services/iam.js';
import colors from '@colors/colors';

export class ResourceActionsPrompt {
  credentials: AwsCredentialIdentityProvider;
  resourceActions: ({ value: string, name: string } | Separator)[];

  constructor(credentials: AwsCredentialIdentityProvider) {
    this.credentials = credentials;
    this.resourceActions = [
      { value: undefined, name: colors.underline('Done') },
      new Separator(colors.grey('Actions')),
      { value: 'createUser', name: 'Create an IAM user' },
    ];
  }

  async run() {
    const selectedResourceAction = await select({
      message: 'Choose a resource to create in the selected account',
      choices: this.resourceActions,
    });

    switch (selectedResourceAction) {
      case 'createUser':
        const userName = await input({ message: 'What should be the name of the user?' });
        const user = await createUser(this.credentials, userName);

        const shouldAttachAdministratorAccessPolicy = await confirm({ message: 'Would you like to attach the AdministratorAccess policy?' });
        if (shouldAttachAdministratorAccessPolicy) {
          await attachUserPolicy(this.credentials, user);
        }

        const shouldCreateAccessKey = await confirm({ message: 'Would you like to create an access key for programmatic use?' });
        if (shouldCreateAccessKey) {
          const accessKey = await createUserAccessKey(this.credentials, user);

          console.log(JSON.stringify(accessKey, null, 2));
        }

        break;
      default:
        return;
    }

    await this.run();
  }
}
