const fs = require('fs');
const { execSync } = require('child_process');

async function deployLambdaEdge() {
  console.log("\n🚀 Deploying Lambda@Edge for JWT validation...");
  
  try {
    // First, update the Lambda function config with Cognito details
    console.log("📝 Updating Lambda function configuration...");
    
    // Get Cognito User Pool details
    const authStackName = execSync(
      'aws cloudformation describe-stacks --query "Stacks[?contains(StackName, \'authplayerjwtcognito\')].StackName" --output text',
      { encoding: 'utf8' }
    ).trim();
    
    const userPoolId = execSync(
      `aws cloudformation describe-stacks --stack-name "${authStackName}" --query "Stacks[0].Outputs[?OutputKey=='UserPoolId'].OutputValue" --output text`,
      { encoding: 'utf8' }
    ).trim();
    
    const region = execSync('aws configure get region', { encoding: 'utf8' }).trim() || 'us-west-2';
    
    // Get JWKS from Cognito
    const jwksUrl = `https://cognito-idp.${region}.amazonaws.com/${userPoolId}/.well-known/jwks.json`;
    const jwks = execSync(`curl -s "${jwksUrl}"`, { encoding: 'utf8' });
    
    console.log("User Pool ID:", userPoolId);
    console.log("Region:", region);
    
    // Update config.js file
    const configPath = `${__dirname}/../backend/function/jwtauth/src/config.js`;
    const configContent = `var config = {};

config.REGION = '${region}';
config.USERPOOLID = '${userPoolId}';
config.JWKS = '${jwks.replace(/'/g, "\\'")}';

module.exports = config;`;
    
    fs.writeFileSync(configPath, configContent);
    console.log("✅ Lambda function configuration updated");
    
    // Get the existing Amplify Lambda function code
    const functionStackName = execSync(
      'aws cloudformation describe-stacks --query "Stacks[?contains(StackName, \'functionjwtauth\')].StackName" --output text',
      { encoding: 'utf8' }
    ).trim();
    
    console.log("Lambda function stack name:", functionStackName);
    
    const functionName = execSync(
      `aws cloudformation describe-stacks --stack-name "${functionStackName}" --query "Stacks[0].Outputs[?OutputKey=='Name'].OutputValue" --output text`,
      { encoding: 'utf8' }
    ).trim();
    
    console.log("Lambda function name:", functionName);

    // Download the function code
    console.log("Downloading Lambda function code...");
    const zipPath = `${__dirname}/lambda-edge-function.zip`;
    execSync(
      `aws lambda get-function --function-name ${functionName} --query 'Code.Location' --output text | xargs curl -o ${zipPath}`,
      { encoding: 'utf8' }
    );

    // Check for existing IAM role for Lambda@Edge
    console.log("Checking for existing IAM role...");
    let roleArn;
    
    try {
      roleArn = execSync(
        'aws iam get-role --role-name lambda-edge-execution-role-dev --query "Role.Arn" --output text',
        { encoding: 'utf8' }
      ).trim();
      console.log("Using existing IAM role:", roleArn);
    } catch (roleError) {
      // Create new role if it doesn't exist
      console.log("Creating new IAM role for Lambda@Edge...");
      
      const trustPolicy = {
        Version: "2012-10-17",
        Statement: [
          {
            Effect: "Allow",
            Principal: {
              Service: ["lambda.amazonaws.com", "edgelambda.amazonaws.com"]
            },
            Action: "sts:AssumeRole"
          }
        ]
      };
      
      execSync(
        `aws iam create-role --role-name lambda-edge-execution-role-dev --assume-role-policy-document '${JSON.stringify(trustPolicy)}'`,
        { encoding: 'utf8' }
      );
      
      execSync(
        'aws iam attach-role-policy --role-name lambda-edge-execution-role-dev --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole',
        { encoding: 'utf8' }
      );
      
      roleArn = execSync(
        'aws iam get-role --role-name lambda-edge-execution-role-dev --query "Role.Arn" --output text',
        { encoding: 'utf8' }
      ).trim();
      
      // Wait for role to be available
      await new Promise(resolve => setTimeout(resolve, 10000));
    }
    
    const edgeFunctionName = `${functionName}-edge`;
    
    // Check if Lambda@Edge function exists in us-east-1
    try {
      execSync(
        `aws lambda get-function --region us-east-1 --function-name ${edgeFunctionName}`,
        { encoding: 'utf8', stdio: 'pipe' }
      );
      
      // Function exists, update it
      console.log("Updating existing Lambda@Edge function...");
      execSync(
        `aws lambda update-function-code --region us-east-1 --function-name ${edgeFunctionName} --zip-file fileb://${zipPath}`,
        { encoding: 'utf8' }
      );
      
    } catch (getError) {
      // Function doesn't exist, create it
      console.log("Creating new Lambda@Edge function...");
      execSync(
        `aws lambda create-function --region us-east-1 --function-name ${edgeFunctionName} --runtime nodejs22.x --role "${roleArn}" --handler index.handler --zip-file fileb://${zipPath} --timeout 1`,
        { encoding: 'utf8' }
      );
    }

    // Wait for function to be ready
    console.log("Waiting for Lambda function to be ready...");
    let attempts = 0;
    const maxAttempts = 30;
    
    while (attempts < maxAttempts) {
      try {
        execSync(
          `aws lambda get-function --region us-east-1 --function-name ${edgeFunctionName}`,
          { encoding: 'utf8', stdio: 'pipe' }
        );
        console.log("Lambda function is ready!");
        break;
      } catch (error) {
        console.log("Waiting for function to be available...");
        await new Promise(resolve => setTimeout(resolve, 2000));
        attempts++;
      }
    }
    
    if (attempts >= maxAttempts) {
      throw new Error("Lambda function did not become ready within timeout");
    }

    // Publish version
    const versionArn = execSync(
      `aws lambda publish-version --region us-east-1 --function-name ${edgeFunctionName} --query 'FunctionArn' --output text`,
      { encoding: 'utf8' }
    ).trim();
    
    console.log("Published Lambda@Edge version ARN:", versionArn);

    // Cleanup zip file
    fs.unlinkSync(zipPath);

    // Get CloudFront distribution ID from CDK stack outputs
    const stackName = execSync(
      'aws cloudformation describe-stacks --query "Stacks[?contains(StackName, \'customResource\')].StackName" --output text',
      { encoding: 'utf8' }
    ).trim().split('\t')[0];
    
    console.log("CloudFront stack name:", stackName);
    
    const distributionId = execSync(
      `aws cloudformation describe-stacks --stack-name "${stackName}" --query "Stacks[0].Outputs[?OutputKey=='CloudFrontDistributionId'].OutputValue" --output text`,
      { encoding: 'utf8' }
    ).trim();
    
    console.log("Distribution ID:", distributionId);

    // Get current distribution config
    const currentConfig = JSON.parse(execSync(
      `aws cloudfront get-distribution-config --id ${distributionId}`,
      { encoding: 'utf8' }
    ));

    const etag = currentConfig.ETag;
    const config = currentConfig.DistributionConfig;

    // Add Lambda@Edge to default cache behavior
    config.DefaultCacheBehavior.LambdaFunctionAssociations = {
      Quantity: 1,
      Items: [{
        LambdaFunctionARN: versionArn,
        EventType: "viewer-request",
        IncludeBody: false
      }]
    };

    // Update distribution
    const distributionConfigPath = `${__dirname}/temp-distribution-config.json`;
    fs.writeFileSync(distributionConfigPath, JSON.stringify(config, null, 2));

    execSync(
      `aws cloudfront update-distribution --id ${distributionId} --distribution-config file://${distributionConfigPath} --if-match ${etag}`,
      { encoding: 'utf8' }
    );

    // Cleanup
    fs.unlinkSync(distributionConfigPath);

    console.log("✅ Lambda@Edge deployment completed!");
    console.log("⏳ CloudFront distribution is updating (this may take 10-15 minutes)");

    // Update S3 bucket policy with correct distribution ID
    console.log("\n🔧 Updating S3 bucket policy with correct distribution ID...");
    try {
      const accountId = execSync('aws sts get-caller-identity --query Account --output text', { encoding: 'utf8' }).trim();
      
      const s3StackName = execSync(
        'aws cloudformation describe-stacks --query "Stacks[?contains(StackName, \'storages3\')].StackName" --output text',
        { encoding: 'utf8' }
      ).trim();

      if (s3StackName) {
        const bucketName = execSync(
          `aws cloudformation describe-stacks --stack-name "${s3StackName}" --query "Stacks[0].Outputs[?OutputKey=='BucketName'].OutputValue" --output text`,
          { encoding: 'utf8' }
        ).trim();

        if (bucketName) {
          const bucketPolicy = {
            Version: "2008-10-17",
            Statement: [{
              Effect: "Allow",
              Principal: {
                Service: "cloudfront.amazonaws.com"
              },
              Action: "s3:GetObject",
              Resource: `arn:aws:s3:::${bucketName}/*`,
              Condition: {
                StringEquals: {
                  "AWS:SourceArn": `arn:aws:cloudfront::${accountId}:distribution/${distributionId}`
                }
              }
            }]
          };

          execSync(
            `aws s3api put-bucket-policy --bucket "${bucketName}" --policy '${JSON.stringify(bucketPolicy)}'`,
            { encoding: 'utf8' }
          );
          
          console.log("✅ S3 bucket policy updated successfully!");
        }
      }
    } catch (error) {
      console.log("⚠️  Could not update S3 bucket policy:", error.message);
    }
    
  } catch (error) {
    console.log("⚠️  Lambda@Edge deployment failed:", error.message);
    console.log("Please check the AWS console and try running 'amplify push' again.");
  }
}

// Execute the deployment
deployLambdaEdge();
