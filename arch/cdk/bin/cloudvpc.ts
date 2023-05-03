#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { CloudVpcStack } from '../lib/cloudvpc-stack';
import { DevopsStack } from '../lib/devops-stack';
import { VideoStorageStack } from '../lib/video-storage-stack';
import { VideoProcessingStack } from '../lib/video-processing-stack';

const app = new cdk.App();
const account = '841493508515';
const region = 'us-east-1'

const devopsStack = new DevopsStack(app, 'DevopsStack', {
  env: { account: account, region: region },
});

const videoStorageStack = new VideoStorageStack(app, 'VideoStorageStack', {
  env: { account: account, region: region },
});

const cloudVpcStack = new CloudVpcStack(app, 'CloudVpcStack', {
  /* If you don't specify 'env', this stack will be environment-agnostic.
   * Account/Region-dependent features and context lookups will not work,
   * but a single synthesized template can be deployed anywhere. */

  /* Uncomment the next line to specialize this stack for the AWS Account
   * and Region that are implied by the current CLI configuration. */
  // env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION },

  /* Uncomment the next line if you know exactly what Account and Region you
   * want to deploy the stack to. */
  env: { account: account, region: region },

  /**
   *    env: {
        account: process.env.CDK_DEFAULT_ACCOUNT,
        region: process.env.CDK_DEFAULT_REGION
    }
   */

  /* For more information, see https://docs.aws.amazon.com/cdk/latest/guide/environments.html */
});


new VideoProcessingStack(app, 'VideoProcessingStack', {
  env: { account, region },
  vpc: cloudVpcStack.vpc,
  bus: cloudVpcStack.bus,
  ecr_repo: devopsStack.ecsPipeline.ecr_repo,
  customerStorageLow: videoStorageStack.customerStorageLow,
  customerStorageHigh: videoStorageStack.customerStorageHigh,
  videoDistributionBucket: videoStorageStack.videoDistributionBucket
});


app.synth();