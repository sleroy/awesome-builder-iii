import * as cdk from 'aws-cdk-lib';
import * as ec2 from "aws-cdk-lib/aws-ec2"
import * as ecs from "aws-cdk-lib/aws-ecs"
import * as iam from "aws-cdk-lib/aws-iam"

import { aws_s3 as s3, RemovalPolicy } from 'aws-cdk-lib';

import { Construct } from 'constructs';
import { BlockPublicAccess, BucketEncryption, StorageClass } from 'aws-cdk-lib/aws-s3';
import { ArnPrincipal } from 'aws-cdk-lib/aws-iam';
import { removeUnusedVideosLifecyclePolicy, s3AllPolicy } from './policies';

// import * as sqs from 'aws-cdk-lib/aws-sqs';

export class CloudVpcStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // The code that defines your stack goes here
    const vpc = new ec2.Vpc(this, "MyVpc", {
      maxAzs: 3 // Default is all AZs in region
    });

    /** Buckets */    
    const storageClass: s3.StorageClass = StorageClass.INFREQUENT_ACCESS; 
    const tagFilters:  s3.Transition = {
      storageClass: storageClass,
    
      // the properties below are optional
      transitionAfter: cdk.Duration.days(30),
      transitionDate: new Date(),
    };

    /** Unprocessed bucket and policy */
    const unprocessedVideosBucket = new s3.Bucket(this, 'UnProcessedVideoBucket', {
      bucketName: 'unprocessed-video-bucket',
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      encryption: BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      eventBridgeEnabled: true,
      versioned: true,
      removalPolicy: RemovalPolicy.DESTROY,
      publicReadAccess: false,
      lifecycleRules: [ removeUnusedVideosLifecyclePolicy(30) ]
    });
    unprocessedVideosBucket.addToResourcePolicy(s3AllPolicy());
  

    // Deploy assets
    /** 
    const mySiteDeploy = new s3Deployment.BucketDeployment(this, 'deployAdminSite', {
      sources: [s3Deployment.Source.asset("./mysite")],
      destinationBucket: mySiteBucket
    });
    */
   
    // example resource
    // const queue = new sqs.Queue(this, 'GitQueue', {
    //   visibilityTimeout: cdk.Duration.seconds(300)
    // });
  }
}
