import chalk from 'chalk';
import { Account, OrganizationalUnit, Root } from '@aws-sdk/client-organizations';
import { input, select, Separator, checkbox, confirm, editor } from '@inquirer/prompts';
import { AwsCredentialIdentityProvider } from '@smithy/types';
import { User } from '@aws-sdk/client-iam';
import { Command } from 'commander';
import { BasePrompt } from './BasePrompt.ts';
import { OrganizationsService } from '../services/OrganizationsService.ts';
import { IamService } from '../services/IamService.ts';
import { KmsService } from '../services/KmsService.ts';
import { SecretsManagerService } from '../services/SecretsManagerService.ts';
import { AcmService } from '../services/AcmService.ts';
import { AccountService } from '../services/AccountService.ts';
import { CredentialProviderService } from '../services/CredentialProviderService.ts';

export class OrganizationsPrompt extends BasePrompt {
  accounts: Account[] = [];
  organizationRoot: Root = {};
  organizationalUnits: OrganizationalUnit[] = [];
  credentialProviderService: CredentialProviderService;
  organizationsService: OrganizationsService;
  credentials?: AwsCredentialIdentityProvider;
  iamService?: IamService;
  kmsService?: KmsService;
  secretsManagerService?: SecretsManagerService;
  acmService?: AcmService;
  accountService?: AccountService;

  constructor(program: Command) {
    super(program);

    this.credentialProviderService = new CredentialProviderService();
    this.organizationsService = new OrganizationsService();
  }

  async run() {
    this.spinner.start('Fetching organization');
    const [organization, organizationRoot] = await Promise.all([
      this.organizationsService.getOrganization(),
      this.organizationsService.getOrganizationRoot(),
    ]);

    if (!organization?.Id) {
      this.spinner.stop();
      console.error(chalk.red('⚠  No organization found'));

      return;
    }

    this.spinner.text = 'Fetching existing organizational units';
    this.organizationalUnits = await this.organizationsService.getAllOrganizationalUnits(organizationRoot.Id);

    this.spinner.text = 'Fetching existing accounts';
    this.accounts = await this.organizationsService.getAllAccounts();

    this.spinner.stop();

    const selectedAccountId = await select({
      message: 'Which account should be used?',
      choices: [
        { value: undefined, name: chalk.underline('Create a new acount') },
        new Separator(chalk.grey(!this.organizationalUnits.length ? 'There are no existing accounts' : 'Accounts')),
        ...this.accounts.map((account) => ({
          value: account.Id,
          name: account.Name,
        })),
      ],
      pageSize: 10,
    });

    let account: Account = {};
    let parentOrganizationalUnit: OrganizationalUnit = {};

    if (selectedAccountId) {
      account = this.accounts.find((item) => item.Id === selectedAccountId) || {};

      const parent = await this.organizationsService.getParentOrganizationalUnit(account.Id);
      parentOrganizationalUnit = this.organizationalUnits.find((item) => item.Id === parent.Id) || {};
    } else {
      const selectedParentOrganizationalUnitId = await select({
        message: 'What should be the parent organizational unit of the account?',
        choices: [
          {
            value: undefined,
            name: chalk.underline('Create a new organizational unit'),
          },
          new Separator(
            chalk.grey(
              !this.organizationalUnits.length ? 'There are no existing organizational units' : 'Organizational units',
            ),
          ),
          ...this.organizationalUnits.map((organizationalUnit) => ({
            value: organizationalUnit.Id,
            name: organizationalUnit.Name,
          })),
        ],
      });

      if (selectedParentOrganizationalUnitId) {
        parentOrganizationalUnit =
          this.organizationalUnits.find((item) => item.Id === selectedParentOrganizationalUnitId) || {};
      } else {
        const parentOrganizationalUnitName = await input({
          message: 'Name of the new parent organizational unit',
        });

        this.spinner.start(`Creating new organizational unit '${parentOrganizationalUnitName}'`);
        parentOrganizationalUnit =
          (await this.organizationsService.createOrganizationalUnit(
            parentOrganizationalUnitName,
            this.organizationRoot.Id,
          )) || {};
        this.spinner.stop();
      }

      const accountName = await input({
        message: `Name of the new account to be placed under organizational unit '${parentOrganizationalUnit.Name}'`,
      });
      const accountEmail = await input({
        message: 'And what about the email address?',
      });

      this.spinner.start(`Creating new account '${accountName}'`);
      account =
        (await this.organizationsService.createAccount(
          accountName,
          accountEmail,
          this.organizationRoot.Id,
          parentOrganizationalUnit.Id,
        )) || {};
    }

    if (!account?.Id) {
      console.error(chalk.red('⚠  No account found'));

      return;
    }

    this.credentials = this.credentialProviderService.getTemporaryCredentials(account.Id);

    this.iamService = new IamService(this.credentials);
    this.kmsService = new KmsService(this.credentials);
    this.secretsManagerService = new SecretsManagerService(this.credentials);
    this.acmService = new AcmService(this.credentials);
    this.accountService = new AccountService(this.credentials);

    this.spinner.stop();

    await this.openResourceActionsMenu();
  }

  async openResourceActionsMenu() {
    const selectedResourceAction = await select({
      message: 'Choose a resource to create in the selected account',
      choices: [
        { value: undefined, name: chalk.underline('Done') },
        new Separator(chalk.grey('Actions')),
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

    await this.openResourceActionsMenu();
  }

  async setupUser() {
    this.spinner.start('Fetching IAM users');
    const users = (await this.iamService?.getUsers()) || [];
    this.spinner.stop();

    const selectedUserArn = await select({
      message: 'Choose an existing IAM user, or create a new one',
      choices: [
        { value: undefined, name: chalk.underline('Create new user') },
        new Separator(chalk.grey('Available users')),
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

      selectedUser = await this.iamService?.createUser(userName);
    }

    this.spinner.start('Fetching IAM policies');
    const policies = (await this.iamService?.getPolicies()) || [];
    this.spinner.stop();

    const selectedPolicies = await checkbox({
      message: 'Select permissions policies to attach to the user',
      choices: [
        { value: undefined, name: chalk.underline('Skip') },
        new Separator(chalk.grey('Available policies')),
        ...policies.map((policy) => ({
          value: policy.Arn,
          name: policy.PolicyName,
        })),
      ],
    });
    const [firstSelectedPolicy] = selectedPolicies;

    if (firstSelectedPolicy) {
      await this.iamService?.attachUserPolicies(selectedUser, selectedPolicies);
    }

    const accessKeyMetadata = await this.iamService?.getUserAccessKeys(selectedUser);

    if ((accessKeyMetadata?.length || 0) < 2) {
      const shouldCreateAccessKey = await confirm({
        message: 'Would you like to create an access key for programmatic use?',
      });

      if (shouldCreateAccessKey) {
        const accessKey = await this.iamService?.createUserAccessKey(selectedUser);
        const table = this.tableWithoutStringQuotes([
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
    if (!keyAliasName) return console.error(chalk.red('⚠  The alias name is required'));

    this.spinner.start('Creating new key');
    const keyMetadata = await this.kmsService?.createKey(`alias/${keyAliasName}`);
    this.spinner.stop();

    const table = this.tableWithoutStringQuotes([
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
      const policy = await this.kmsService?.getKeyPolicy(keyMetadata);
      const newPolicy = await editor({
        message: '',
        default: policy,
        postfix: '.json',
        waitForUseInput: false,
      });

      await this.kmsService?.updateKeyPolicy(keyMetadata, newPolicy);
    }
  }

  async createSecret() {
    const secretName = await input({ message: 'What should be the name of the new secret?' });
    if (!secretName) return console.error(chalk.red('⚠  The name is required'));

    this.spinner.start('Fetching existing KMS keys');
    const keys = (await this.kmsService?.listKeys()) || [];
    this.spinner.stop();

    let selectedKeyAliasName: string | undefined;

    selectedKeyAliasName = await select({
      message: 'Choose an existing KMS key, or use the default (aws/secretsmanager)',
      choices: [
        { value: undefined, name: chalk.underline('Use default (aws/secretsmanager)') },
        { value: 'new', name: chalk.underline('Provide a KMS key yourself') },
        new Separator(chalk.grey('Available keys')),
        ...keys.map((key) => ({ value: key?.KeyId, name: key?.Aliases?.[0]?.AliasName })),
      ],
    });

    if (selectedKeyAliasName === 'new') {
      selectedKeyAliasName = await input({ message: 'What is the ARN of the KMS key you want the new secret to use?' });
    }

    this.spinner.start('Creating new secret');
    const secret = await this.secretsManagerService?.createSecret(secretName, selectedKeyAliasName);
    this.spinner.stop();

    const table = this.tableWithoutStringQuotes([
      {
        'Secret name': secret?.Name,
        'Secret ARN': secret?.ARN,
      },
    ] as never[]);

    console.info(table);
  }

  async requestCertificate() {
    this.spinner.start('Fetching available regions');
    const regions = await this.accountService?.listRegions();
    this.spinner.stop();

    const selectedRegion = await select({
      message: 'Which region should this certificate be created in?',
      choices: [
        new Separator(chalk.grey('All available regions')),
        ...(regions?.map((region) => ({ value: region.RegionName, name: region.RegionName })) || []),
      ],
    });

    const commaSeparatedDomainNames = await input({
      message: `Provide a comma separated list of FQDN's, starting with the main one`,
    });
    const domainNames = commaSeparatedDomainNames.split(',').map((domainName) => domainName.trim());
    if (!domainNames.length) return console.error(chalk.red('⚠  Please provide at lease one FQDN'));

    this.spinner.start('Requesting new certificate');
    const certificate = await this.acmService?.requestCertificate(domainNames, selectedRegion);
    this.spinner.stop();

    const arnTable = this.tableWithoutStringQuotes([{ 'Certificate ARN': certificate?.CertificateArn }] as never[]);
    const domainTable = this.tableWithoutStringQuotes(
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
