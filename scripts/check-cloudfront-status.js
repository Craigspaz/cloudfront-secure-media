#!/usr/bin/env node

const { execSync } = require('child_process');

async function checkCloudFrontStatus() {
    try {
        // Get CloudFront distribution ID from custom resource stack
        const distributionId = execSync(`aws cloudformation describe-stacks --query "Stacks[?contains(StackName, 'customResource')].Outputs[?OutputKey=='CloudFrontDistributionId'].OutputValue" --output text`, { encoding: 'utf8' }).trim();
        
        if (!distributionId || distributionId === 'None') {
            console.log('❌ Could not find CloudFront distribution ID');
            return;
        }

        console.log(`🔍 Checking CloudFront distribution status: ${distributionId}`);
        
        let status = 'InProgress';
        let attempts = 0;
        const maxAttempts = 60; // 10 minutes max wait
        
        while (status === 'InProgress' && attempts < maxAttempts) {
            try {
                status = execSync(`aws cloudfront get-distribution --id ${distributionId} --query 'Distribution.Status' --output text`, { encoding: 'utf8' }).trim();
                
                if (status === 'Deployed') {
                    console.log('✅ CloudFront distribution is ready!');
                    console.log('🚀 You can now run: npm start');
                    break;
                } else {
                    process.stdout.write(`⏳ Status: ${status} (${attempts + 1}/${maxAttempts}) - waiting 10s...\r`);
                    await new Promise(resolve => setTimeout(resolve, 10000));
                    attempts++;
                }
            } catch (error) {
                console.log(`\n❌ Error checking status: ${error.message}`);
                break;
            }
        }
        
        if (attempts >= maxAttempts) {
            console.log('\n⏰ Timeout reached. Please check CloudFront console manually.');
            console.log(`📊 Check status: aws cloudfront get-distribution --id ${distributionId} --query 'Distribution.Status' --output text`);
        }
        
    } catch (error) {
        console.log('❌ Failed to check CloudFront status:', error.message);
        console.log('ℹ️  You can manually check the status in AWS Console or run npm start when ready');
    }
}

checkCloudFrontStatus();
