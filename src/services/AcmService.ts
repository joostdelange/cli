import { AwsCredentialIdentityProvider } from '@smithy/types';
import { ACMClient } from '@aws-sdk/client-acm';
import { RequestCertificateCommand, DescribeCertificateCommand } from '@aws-sdk/client-acm';
import { ValidationMethod, CertificateDetail } from '@aws-sdk/client-acm';

export class AcmService {
  credentials: AwsCredentialIdentityProvider;
  acmClient: ACMClient;

  constructor(credentials: AwsCredentialIdentityProvider) {
    this.credentials = credentials;
    this.acmClient = new ACMClient({ credentials });
  }

  async requestCertificate(domainNames: string[], region?: string) {
    this.acmClient = new ACMClient({ credentials: this.credentials, region });

    const [domainName] = domainNames;
    const alternativeDomainNames = domainNames.filter((_, index) => index !== 0);

    const requestCertificateCommand = new RequestCertificateCommand({
      ValidationMethod: ValidationMethod.DNS,
      DomainName: domainName,
      SubjectAlternativeNames: alternativeDomainNames.length ? alternativeDomainNames : undefined,
    });
    const { CertificateArn } = await this.acmClient.send(requestCertificateCommand);

    const describeCertificateCommand = new DescribeCertificateCommand({ CertificateArn });
    let certificate: CertificateDetail | undefined;

    while (!certificate?.DomainValidationOptions?.[0]?.ResourceRecord) {
      await new Promise((resolve) => setTimeout(() => resolve('sleep'), 2000));

      certificate = (await this.acmClient.send(describeCertificateCommand)).Certificate;
    }

    return certificate;
  }
}
