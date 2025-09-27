#!/usr/bin/env node

const { execSync } = require('child_process');

console.log('🧹 Cleaning up Lambda@Edge resources...');

try {
  // Get the Lambda function name from Amplify stack
  const functionStackName = execSync(
    'aws cloudformation describe-stacks --query "Stacks[?contains(StackName, \'functionjwtauth\')].StackName" --output text',
    { encoding: 'utf8' }
  ).trim();

  if (functionStackName) {
    const functionName = execSync(
      `aws cloudformation describe-stacks --stack-name "${functionStackName}" --query "Stacks[0].Outputs[?OutputKey=='Name'].OutputValue" --output text`,
      { encoding: 'utf8' }
    ).trim();

    const edgeFunctionName = `${functionName}-edge`;

    // First, remove Lambda@Edge from CloudFront distribution
    try {
      console.log('Removing Lambda@Edge association from CloudFront...');
      
      const stackName = execSync(
        'aws cloudformation describe-stacks --query "Stacks[?contains(StackName, \'customResource\')].StackName" --output text',
        { encoding: 'utf8' }
      ).trim().split('\t')[0];
      
      const distributionId = execSync(
        `aws cloudformation describe-stacks --stack-name "${stackName}" --query "Stacks[0].Outputs[?OutputKey=='CloudFrontDistributionId'].OutputValue" --output text`,
        { encoding: 'utf8' }
      ).trim();

      if (distributionId && distributionId !== 'None') {
        const currentConfig = JSON.parse(execSync(
          `aws cloudfront get-distribution-config --id ${distributionId}`,
          { encoding: 'utf8' }
        ));

        const etag = currentConfig.ETag;
        const config = currentConfig.DistributionConfig;

        // Remove Lambda@Edge association
        config.DefaultCacheBehavior.LambdaFunctionAssociations = {
          Quantity: 0,
          Items: []
        };

        const fs = require('fs');
        const configPath = `${__dirname}/temp-distribution-config.json`;
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

        execSync(
          `aws cloudfront update-distribution --id ${distributionId} --distribution-config file://${configPath} --if-match ${etag}`,
          { encoding: 'utf8' }
        );

        fs.unlinkSync(configPath);
        console.log('✅ Lambda@Edge association removed from CloudFront');
        console.log('⏳ Wait for CloudFront to propagate (~15 minutes) before Lambda@Edge can be deleted');
      }
    } catch (error) {
      console.log('⚠️  Could not remove CloudFront association:', error.message);
    }

    // Note about Lambda@Edge deletion
    console.log(`📝 Lambda@Edge function ${edgeFunctionName} will be automatically deleted`);
    console.log('   after CloudFront distribution propagation completes.');
  }

  // Delete IAM role
  try {
    console.log('Deleting IAM role: lambda-edge-execution-role-dev');
    
    // Detach policies first
    execSync(
      'aws iam detach-role-policy --role-name lambda-edge-execution-role-dev --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole',
      { encoding: 'utf8' }
    );
    
    // Delete role
    execSync(
      'aws iam delete-role --role-name lambda-edge-execution-role-dev',
      { encoding: 'utf8' }
    );
    
    console.log('✅ IAM role deleted');
  } catch (error) {
    console.log('⚠️  IAM role not found or already deleted');
  }

  console.log('✅ Lambda@Edge cleanup completed!');

} catch (error) {
  console.error('❌ Cleanup failed:', error.message);
  process.exit(1);
}
