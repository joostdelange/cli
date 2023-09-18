import colors from '@colors/colors';
import { Ora } from 'ora';
import { AwsCredentialIdentityProvider } from '@smithy/types';
import { input, select, checkbox, confirm, Separator } from '@inquirer/prompts';
import { createUser, getPolicies, attachUserPolicies, createUserAccessKey } from '../services/iam.js';
import { tableWithoutStringQuotes } from '../helpers/console.js';

export class ResourceActionsPrompt {
  credentials: AwsCredentialIdentityProvider;
  spinner: Ora;
  resourceActions: ({ value: string, name: string } | Separator)[];

  constructor(credentials: AwsCredentialIdentityProvider, spinner: Ora) {
    this.credentials = credentials;
    this.spinner = spinner;
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
        await this.createUser();

        break;
      default:
        return;
    }

    await this.run();
  }

  async createUser() {
    const userName = await input({ message: 'What should be the name of the user?' });
    const user = await createUser(this.credentials, userName);

    this.spinner.start('Fetching IAM policies');
    const policies = await getPolicies(this.credentials);
    this.spinner.stop();

    const selectedPolicies = await checkbox({
      message: 'Select permissions policies to attach to the user',
      choices: [
        { value: undefined, name: colors.underline('Skip') },
        new Separator(colors.grey('Available policies')),
        ...policies.map((policy) => ({ value: policy.Arn, name: policy.PolicyName }))
      ],
    });

    if (selectedPolicies[0]) {
      await attachUserPolicies(this.credentials, user, selectedPolicies);
    }

    const shouldCreateAccessKey = await confirm({ message: 'Would you like to create an access key for programmatic use?' });

    if (shouldCreateAccessKey) {
      const accessKey = await createUserAccessKey(this.credentials, user);
      const table = tableWithoutStringQuotes([{
        'User name': accessKey.UserName,
        'Access key id': accessKey.AccessKeyId,
        'Secret access key': accessKey.SecretAccessKey,
      }]);

      console.log(table);
    }
  }
}
