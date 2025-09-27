#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('📹 Uploading demo video to S3...');

try {
  // Get S3 bucket name from CDK stack
  const stackName = execSync(
    'aws cloudformation describe-stacks --query "Stacks[?contains(StackName, \'customResource\')].StackName" --output text',
    { encoding: 'utf8' }
  ).trim().split('\t')[0];

  const bucketName = execSync(
    `aws cloudformation describe-stacks --stack-name "${stackName}" --query "Stacks[0].Outputs[?OutputKey=='BucketName'].OutputValue" --output text`,
    { encoding: 'utf8' }
  ).trim();

  console.log(`🪣 S3 Bucket: ${bucketName}`);

  // Check if HLS files exist
  const hlsDir = path.join(__dirname, '..', 'demo', 'video', 'hls');
  if (!fs.existsSync(hlsDir)) {
    console.log('❌ HLS files not found. Please run ./convert-to-hls.sh first');
    process.exit(1);
  }

  // Upload HLS files to S3
  console.log('⬆️  Uploading HLS files...');
  execSync(`aws s3 sync ${hlsDir} s3://${bucketName}/ --delete`, { stdio: 'inherit' });

  console.log('✅ Demo video uploaded successfully!');
  console.log(`🎯 Video will be available at: https://[CLOUDFRONT-URL]/big_buck_bunny.m3u8`);

} catch (error) {
  console.error('❌ Failed to upload demo video:', error.message);
  process.exit(1);
}
