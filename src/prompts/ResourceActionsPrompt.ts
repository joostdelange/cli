import colors from '@colors/colors';
import { Ora } from 'ora';
import { AwsCredentialIdentityProvider } from '@smithy/types';
import { input, select, checkbox, confirm, Separator, editor } from '@inquirer/prompts';
import { User } from '@aws-sdk/client-iam';
import { IamService } from '../services/IamService.js';
import { KmsService } from '../services/KmsService.js';
import { SecretsManagerService } from '../services/SecretsManagerService.js';
import { AcmService } from '../services/AcmService.js';
import { AccountService } from '../services/AccountService.js';
import { tableWithoutStringQuotes } from '../helpers/console.js';

export class ResourceActionsPrompt {
  credentials: AwsCredentialIdentityProvider;
  spinner: Ora;
  iamService: IamService;
  kmsService: KmsService;
  secretsManagerService: SecretsManagerService;
  acmService: AcmService;
  accountService: AccountService;

  constructor(credentials: AwsCredentialIdentityProvider, spinner: Ora) {
    this.credentials = credentials;
    this.spinner = spinner;
    this.iamService = new IamService(credentials);
    this.kmsService = new KmsService(credentials);
    this.secretsManagerService = new SecretsManagerService(credentials);
    this.acmService = new AcmService(credentials);
    this.accountService = new AccountService(credentials);
  }

  async run() {
    const selectedResourceAction = await select({
      message: 'Choose a resource to create in the selected account',
      choices: [
        { value: undefined, name: colors.underline('Done') },
        new Separator(colors.grey('Actions')),
        { value: 'setupUser', name: 'Setup an IAM user' },
        { value: 'createKmsKey', name: 'Create a KMS encryption key' },
        { value: 'createSecret', name: 'Create a Secrets Manager secret' },
        { value: 'requestCertificate', name: 'Request a Certificate Manager certificate' },
      ],
    });

    switch (selectedResourceAction) {
      case 'setupUser':
        await this.setupUser();

        break;
      case 'createKmsKey':
        await this.createKmsKey();

        break;

      case 'createSecret':
        await this.createSecret();

        break;
      case 'requestCertificate':
        await this.requestCertificate();

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
      choices: [
        { value: undefined, name: colors.underline('Create new user') },
        new Separator(colors.grey('Available users')),
        ...users.map((user) => ({ value: user.Arn, name: user.UserName })),
      ],
    });

    let selectedUser: User | undefined;

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

    if ((accessKeyMetadata?.length || 0) < 2) {
      const shouldCreateAccessKey = await confirm({
        message: 'Would you like to create an access key for programmatic use?',
      });

      if (shouldCreateAccessKey) {
        const accessKey = await this.iamService.createUserAccessKey(selectedUser);
        const table = tableWithoutStringQuotes([
          {
            'User name': accessKey?.UserName,
            'Access key id': accessKey?.AccessKeyId,
            'Secret access key': accessKey?.SecretAccessKey,
          },
        ] as never[]);

        console.info(table);
      }
    }
  }

  async createKmsKey() {
    const keyAliasName = await input({ message: 'What should be the alias name of the new KMS key?' });
    if (!keyAliasName) return console.error(colors.red('⚠  The alias name is required'));

    this.spinner.start('Creating new key');
    const keyMetadata = await this.kmsService.createKey(`alias/${keyAliasName}`);
    this.spinner.stop();

    const table = tableWithoutStringQuotes([
      {
        'Key alias': keyAliasName,
        'Key ARN': keyMetadata?.Arn,
      },
    ] as never[]);

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

  async createSecret() {
    const secretName = await input({ message: 'What should be the name of the new secret?' });
    if (!secretName) return console.error(colors.red('⚠  The name is required'));

    this.spinner.start('Fetching existing KMS keys');
    const keys = await this.kmsService.listKeys();
    this.spinner.stop();

    let selectedKeyAliasName: string | undefined;

    selectedKeyAliasName = await select({
      message: 'Choose an existing KMS key, or use the default (aws/secretsmanager)',
      choices: [
        { value: undefined, name: colors.underline('Use default (aws/secretsmanager)') },
        { value: 'new', name: colors.underline('Provide a KMS key yourself') },
        new Separator(colors.grey('Available keys')),
        ...keys.map((key) => ({ value: key?.KeyId, name: key?.Aliases?.[0]?.AliasName })),
      ],
    });

    if (selectedKeyAliasName === 'new') {
      selectedKeyAliasName = await input({ message: 'What is the ARN of the KMS key you want the new secret to use?' });
    }

    this.spinner.start('Creating new secret');
    const secret = await this.secretsManagerService.createSecret(secretName, selectedKeyAliasName);
    this.spinner.stop();

    const table = tableWithoutStringQuotes([
      {
        'Secret name': secret.Name,
        'Secret ARN': secret.ARN,
      },
    ] as never[]);

    console.info(table);
  }

  async requestCertificate() {
    this.spinner.start('Fetching available regions');
    const regions = await this.accountService.listRegions();
    this.spinner.stop();

    const selectedRegion = await select({
      message: 'Which region should this certificate be created in?',
      choices: [
        new Separator(colors.grey('All available regions')),
        ...regions.map((region) => ({ value: region.RegionName, name: region.RegionName })),
      ],
    });

    const commaSeparatedDomainNames = await input({
      message: `Provide a comma separated list of FQDN's, starting with the main one`,
    });
    const domainNames = commaSeparatedDomainNames.split(',').map((domainName) => domainName.trim());
    if (!domainNames.length) return console.error(colors.red('⚠  Please provide at lease one FQDN'));

    this.spinner.start('Requesting new certificate');
    const certificate = await this.acmService.requestCertificate(domainNames, selectedRegion);
    this.spinner.stop();

    const arnTable = tableWithoutStringQuotes([{ 'Certificate ARN': certificate.CertificateArn }] as never[]);
    const domainTable = tableWithoutStringQuotes(
      certificate?.DomainValidationOptions?.map((DomainValidationOption) => ({
        'Record name': DomainValidationOption?.ResourceRecord?.Name,
        'Record type': DomainValidationOption?.ResourceRecord?.Type,
        'Record value': DomainValidationOption?.ResourceRecord?.Value,
      })) as never[],
    );

    console.info(arnTable);
    console.info(domainTable);
  }
}
