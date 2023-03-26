import * as cdk from 'aws-cdk-lib';
import * as ec2 from "aws-cdk-lib/aws-ec2"
import * as sqs from "aws-cdk-lib/aws-sqs"
import * as sns from "aws-cdk-lib/aws-sns"
import * as ecs from "aws-cdk-lib/aws-ecs"
import * as iam from "aws-cdk-lib/aws-iam"
import * as subs from 'aws-cdk-lib/aws-sns-subscriptions';

import { aws_s3 as s3, RemovalPolicy } from 'aws-cdk-lib';

import { Construct } from 'constructs';
import { BlockPublicAccess, BucketEncryption, StorageClass, Bucket, BucketNotificationDestinationConfig } from 'aws-cdk-lib/aws-s3';
import { ArnPrincipal } from 'aws-cdk-lib/aws-iam';
import { removeUnusedVideosLifecyclePolicy, s3AllPolicy } from './iam/policies';
import { createBuckets } from './buckets';
import { defineRoles } from './iam';


// import * as sqs from 'aws-cdk-lib/aws-sqs';
import { VideoProcessingStack } from './video-processing-stack';
import { VideoStorageStack } from './video-storage-stack';
import { DevopsStack } from './devops-stack';

export class CloudVpcStack extends cdk.Stack {
  videoProcessingStack: VideoProcessingStack;
  videoStorageStack: VideoStorageStack;
  devopsStack: DevopsStack;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    this.videoStorageStack = new VideoStorageStack(this, id, props);
    this.videoProcessingStack = new VideoProcessingStack(this, id, this.videoStorageStack, props);
    this.devopsStack = new DevopsStack(this, id, props);
  }


}

