import * as cdk from 'aws-cdk-lib';
import * as AmplifyHelpers from '@aws-amplify/cli-extensibility-helper';
import { AmplifyDependentResourcesAttributes } from '../../types/amplify-dependent-resources-ref';
import { Construct } from 'constructs';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as iam from 'aws-cdk-lib/aws-iam';

export class cdkStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps, amplifyResourceProps?: AmplifyHelpers.AmplifyResourceProps) {
    super(scope, id, props);
    
    /* Do not remove - Amplify CLI automatically injects the current deployment environment in this input parameter */
    new cdk.CfnParameter(this, 'env', {
      type: 'String',
      description: 'Current Amplify CLI env name',
    });

    // Get S3 bucket from Amplify storage
    const retVal: AmplifyDependentResourcesAttributes = AmplifyHelpers.addResourceDependency(this, 
      amplifyResourceProps.category, 
      amplifyResourceProps.resourceName, 
      [
        {category: "storage", resourceName: "s3aacf1077"},
      ]
    );

    const bucketName = cdk.Fn.ref(retVal.storage.s3aacf1077.BucketName);
    const bucket = s3.Bucket.fromBucketName(this, 'MediaBucket', bucketName);

    // Create Origin Access Control
    const oac = new cloudfront.CfnOriginAccessControl(this, 'MediaOAC', {
      originAccessControlConfig: {
        name: `secure-media-oac-${cdk.Fn.ref('env')}`,
        originAccessControlOriginType: 's3',
        signingBehavior: 'always',
        signingProtocol: 'sigv4'
      }
    });

    // Create CloudFront distribution using CfnDistribution for full control
    const distribution = new cloudfront.CfnDistribution(this, 'MediaDistribution', {
      distributionConfig: {
        comment: `Secure Media Delivery with JWT Token Validation - ${cdk.Fn.ref('env')}`,
        priceClass: 'PriceClass_100',
        httpVersion: 'http2',
        defaultRootObject: 'index.html',
        enabled: true,
        origins: [{
          id: 'S3Origin',
          domainName: bucket.bucketDomainName,
          originAccessControlId: oac.attrId,
          s3OriginConfig: {
            originAccessIdentity: ''
          }
        }],
        defaultCacheBehavior: {
          targetOriginId: 'S3Origin',
          compress: true,
          allowedMethods: ['GET', 'HEAD'],
          cachedMethods: ['GET', 'HEAD'],
          viewerProtocolPolicy: 'redirect-to-https',
          cachePolicyId: '4135ea2d-6df8-44a3-9df3-4b5a84be39ad', // CachingOptimized
          forwardedValues: {
            queryString: false,
            cookies: { forward: 'none' }
          }
        }
      }
    });

    // Output the distribution details
    new cdk.CfnOutput(this, 'CloudFrontDistributionId', {
      value: distribution.attrId,
      description: 'CloudFront Distribution ID'
    });

    new cdk.CfnOutput(this, 'CloudFrontDistributionDomainName', {
      value: distribution.attrDomainName,
      description: 'CloudFront Distribution Domain Name'
    });

    new cdk.CfnOutput(this, 'CloudFrontDistributionURL', {
      value: `https://${distribution.attrDomainName}`,
      description: 'CloudFront Distribution URL'
    });
  }
}