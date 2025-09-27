# 🔐 Secure Media Streaming with JWT + Lambda@Edge

Secure video streaming solution using JWT tokens validated at CloudFront edge locations with Lambda@Edge.

📋 **[Release Notes](RELEASE_NOTES.md)** | 📄 **[License](LICENSE)**

## 🏗️ Architecture

<img src="/doc/architecture.png" alt="Architecture" />

## 🧩 Components

**Frontend**: React app with Video.js player and AWS Amplify authentication  
**Backend**: Amazon Cognito for auth, Lambda@Edge for JWT validation, CloudFront for CDN  
**Storage**: S3 bucket with Origin Access Control for secure video storage

## 🚀 Quick Deploy

### Prerequisites

```sh
npm install -g @aws-amplify/cli
amplify configure
```

### Setup & Deploy

```sh
git clone https://github.com/aws-samples/cloudfront-secure-media.git
cd cloudfront-secure-media/
npm install
```

**🎥 Optional: Convert Your Video**
```sh
# Place video in demo/video/source/ then run:
./convert-to-hls.sh
```

**📦 Initialize Amplify**
```sh
amplify init
```
- Project name: `cloudfront-secure-media`
- Environment: `dev`
- Editor: `Visual Studio Code`
- Framework: `react`
- Source Directory: `src`
- Distribution Directory: `build`
- Build Command: `npm run-script build`
- Start Command: `npm run-script start`
- AWS profile: `[your-profile]`

**🚢 Deploy Everything**
```sh
npm run deploy
```

This automatically:
- ✅ Deploys Cognito user pool + Lambda function
- ✅ Creates S3 bucket with secure access
- ✅ Configures CloudFront + Lambda@Edge JWT validation
- ✅ Updates frontend with CloudFront URLs
- ✅ Uploads demo video

> **⏱️ Note**: CloudFront deployment takes 10-15 minutes. Check status:  
> `aws cloudfront get-distribution --id <DISTRIBUTION_ID> --query 'Distribution.Status' --output text`  
> Status should show "Deployed" (not "InProgress").

### 🧪 Test Application

```sh
npm start
```

1. 📝 Create account and sign in
2. 🎬 Video player loads with demo video automatically
3. 🔒 Try accessing video URL directly - blocked without authentication

<img src="/doc/Auth01.png" alt="Create Account" width="400" />
<img src="/doc/SimplePlayer.png" alt="Video Player" width="400" />

## 🛠️ Manual Deployment

If you prefer step-by-step:

```sh
amplify push          # First push: Create Cognito + Lambda
amplify push          # Second push: Configure JWT validation
npm run post-deploy   # Update frontend config
npm run upload-demo   # Upload demo video
```

## 🧹 Cleanup (if needed)
In case you want to tear down the setup and remove all resources:

```sh
npm run cleanup
```

This removes:
- Lambda@Edge function (us-east-1)
- IAM role for Lambda@Edge
- All Amplify resources (Cognito, CloudFront, S3, Lambda)

**Manual cleanup (if needed):**
```sh
amplify delete
```

## 📄 License

This sample code is available under a modified MIT-0 [LICENSE](LICENSE)