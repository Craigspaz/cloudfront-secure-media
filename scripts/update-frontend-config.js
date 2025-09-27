#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🔧 Updating frontend configuration with deployment parameters...');

try {
  // Get CloudFront distribution URL from custom CDK stack
  const stackName = execSync(
    'aws cloudformation describe-stacks --query "Stacks[?contains(StackName, \'customResource\')].StackName" --output text',
    { encoding: 'utf8' }
  ).trim().split('\t')[0];

  const cloudfrontUrl = execSync(
    `aws cloudformation describe-stacks --stack-name "${stackName}" --query "Stacks[0].Outputs[?OutputKey=='CloudFrontDistributionURL'].OutputValue" --output text`,
    { encoding: 'utf8' }
  ).trim();

  // Get S3 bucket name
  const s3StackName = execSync(
    'aws cloudformation describe-stacks --query "Stacks[?contains(StackName, \'storages3\')].StackName" --output text',
    { encoding: 'utf8' }
  ).trim();

  const bucketName = execSync(
    `aws cloudformation describe-stacks --stack-name "${s3StackName}" --query "Stacks[0].Outputs[?OutputKey=='BucketName'].OutputValue" --output text`,
    { encoding: 'utf8' }
  ).trim();

  // Create deployment config file
  const deploymentConfig = {
    cloudfront: {
      distributionUrl: cloudfrontUrl,
      demoVideoUrl: `${cloudfrontUrl}/big_buck_bunny.m3u8`
    },
    s3: {
      bucketName: bucketName
    },
    updatedAt: new Date().toISOString()
  };

  // Write config to public folder for frontend access
  const configPath = path.join(__dirname, '..', 'public', 'deployment-config.json');
  fs.writeFileSync(configPath, JSON.stringify(deploymentConfig, null, 2));

  // Also create a JavaScript module version
  const jsConfigPath = path.join(__dirname, '..', 'src', 'deployment-config.js');
  const jsConfig = `// Auto-generated deployment configuration
export const deploymentConfig = ${JSON.stringify(deploymentConfig, null, 2)};
`;
  fs.writeFileSync(jsConfigPath, jsConfig);

  console.log('✅ Frontend configuration updated successfully!');
  console.log(`📺 Demo video URL: ${deploymentConfig.cloudfront.demoVideoUrl}`);
  console.log(`🌐 CloudFront URL: ${cloudfrontUrl}`);
  console.log(`🪣 S3 Bucket: ${bucketName}`);

} catch (error) {
  console.error('❌ Failed to update frontend configuration:', error.message);
  console.log('ℹ️  You may need to manually configure the frontend with your CloudFront URL');
  process.exit(1);
}
