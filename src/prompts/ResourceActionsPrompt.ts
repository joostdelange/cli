import colors from '@colors/colors';
import { Ora } from 'ora';
import { AwsCredentialIdentityProvider } from '@smithy/types';
import { input, select, checkbox, confirm, Separator, editor } from '@inquirer/prompts';
import { User } from '@aws-sdk/client-iam';
import { IamService } from '../services/IamService.js';
import { KmsService } from '../services/KmsService.js';
import { tableWithoutStringQuotes } from '../helpers/console.js';

export class ResourceActionsPrompt {
  credentials: AwsCredentialIdentityProvider;
  spinner: Ora;
  iamService: IamService;
  kmsService: KmsService;

  constructor(credentials: AwsCredentialIdentityProvider, spinner: Ora) {
    this.credentials = credentials;
    this.spinner = spinner;
    this.iamService = new IamService(credentials);
    this.kmsService = new KmsService(credentials);
  }

  async run() {
    const selectedResourceAction = await select({
      message: 'Choose a resource to create in the selected account',
      choices: [{ value: undefined, name: colors.underline('Done') }, new Separator(colors.grey('Actions')), { value: 'setupUser', name: 'Setup an IAM user' }, { value: 'createKmsKey', name: 'Create a KMS encryption key' }],
    });

    switch (selectedResourceAction) {
      case 'setupUser':
        await this.setupUser();

        break;
      case 'createKmsKey':
        await this.createKmsKey();

        break;
      default:
        return;
    }

    await this.run();
  }

  async setupUser() {
    this.spinner.start('Fetching IAM users');
    const users = await this.iamService.getUsers();
    this.spinner.stop();

    const selectedUserArn = await select({
      message: 'Choose an existing IAM user, or create a new one',
      choices: [{ value: undefined, name: colors.underline('Create new user') }, new Separator(colors.grey('Available users')), ...users.map((user) => ({ value: user.Arn, name: user.UserName }))],
    });

    let selectedUser: User;

    if (selectedUserArn) {
      selectedUser = users.find((user) => user.Arn === selectedUserArn);
    } else {
      const userName = await input({
        message: 'What should be the name of the user?',
      });

      selectedUser = await this.iamService.createUser(userName);
    }

    this.spinner.start('Fetching IAM policies');
    const policies = await this.iamService.getPolicies();
    this.spinner.stop();

    const selectedPolicies = await checkbox({
      message: 'Select permissions policies to attach to the user',
      choices: [
        { value: undefined, name: colors.underline('Skip') },
        new Separator(colors.grey('Available policies')),
        ...policies.map((policy) => ({
          value: policy.Arn,
          name: policy.PolicyName,
        })),
      ],
    });
    const [firstSelectedPolicy] = selectedPolicies;

    if (firstSelectedPolicy) {
      await this.iamService.attachUserPolicies(selectedUser, selectedPolicies);
    }

    const accessKeyMetadata = await this.iamService.getUserAccessKeys(selectedUser);

    if (accessKeyMetadata?.length < 2) {
      const shouldCreateAccessKey = await confirm({
        message: 'Would you like to create an access key for programmatic use?',
      });

      if (shouldCreateAccessKey) {
        const accessKey = await this.iamService.createUserAccessKey(selectedUser);
        const table = tableWithoutStringQuotes([
          {
            'User name': accessKey.UserName,
            'Access key id': accessKey.AccessKeyId,
            'Secret access key': accessKey.SecretAccessKey,
          },
        ]);

        console.info(table);
      }
    }
  }

  async createKmsKey() {
    const keyAliasName = await input({
      message: 'What should be the alias name of the new KMS key?',
    });
    if (!keyAliasName) return console.error(colors.red('⚠  The alias name is required'));

    this.spinner.start('Creating new key');
    const keyMetadata = await this.kmsService.createKey(`alias/${keyAliasName}`);

    this.spinner.stop();

    const table = tableWithoutStringQuotes([
      {
        'Key alias': keyAliasName,
        'Key arn': keyMetadata.Arn,
      },
    ]);

    console.info(table);

    const shouldOpenPolicyEditor = await confirm({
      message: 'Would you like to edit the key policy of the key?',
    });

    if (shouldOpenPolicyEditor) {
      const policy = await this.kmsService.getKeyPolicy(keyMetadata);
      const newPolicy = await editor({
        message: '',
        default: policy,
        postfix: '.json',
        waitForUseInput: false,
      });

      await this.kmsService.updateKeyPolicy(keyMetadata, newPolicy);
    }
  }
}
