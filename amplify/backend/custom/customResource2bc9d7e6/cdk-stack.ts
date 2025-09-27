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

    // Create a temporary S3 bucket - will be replaced when storage is added
    const bucket = new s3.Bucket(this, 'MediaBucket', {
      bucketName: `secure-media-${cdk.Fn.ref('AWS::AccountId')}-${cdk.Fn.ref('env')}`,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

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
            queryString: true,
            cookies: { forward: 'none' }
          }
        }
      }
    });

    // Add bucket policy for CloudFront OAC access
    bucket.addToResourcePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      principals: [new iam.ServicePrincipal('cloudfront.amazonaws.com')],
      actions: ['s3:GetObject'],
      resources: [bucket.arnForObjects('*')],
      conditions: {
        StringEquals: {
          'AWS:SourceArn': `arn:aws:cloudfront::${cdk.Fn.ref('AWS::AccountId')}:distribution/${distribution.attrId}`,
        },
      },
    }));

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

    new cdk.CfnOutput(this, 'BucketName', {
      value: bucket.bucketName,
      description: 'S3 Bucket Name'
    });
  }
}