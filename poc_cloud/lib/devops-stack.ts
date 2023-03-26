import * as cdk from 'aws-cdk-lib';
import * as ec2 from "aws-cdk-lib/aws-ec2"
import * as sqs from "aws-cdk-lib/aws-sqs"
import * as sns from "aws-cdk-lib/aws-sns"
import * as s3n from "aws-cdk-lib/aws-s3-notifications"
import * as ecs from "aws-cdk-lib/aws-ecs"
import * as iam from "aws-cdk-lib/aws-iam"
import * as subs from 'aws-cdk-lib/aws-sns-subscriptions';
import * as lambda from 'aws-cdk-lib/aws-lambda';

import { aws_s3 as s3, RemovalPolicy } from 'aws-cdk-lib';

import { Construct } from 'constructs';
import { BlockPublicAccess, BucketEncryption, StorageClass, Bucket, BucketNotificationDestinationConfig } from 'aws-cdk-lib/aws-s3';
import { ArnPrincipal } from 'aws-cdk-lib/aws-iam';
import { removeUnusedVideosLifecyclePolicy, s3AllPolicy } from './iam/policies';
import { createBuckets, createRegularBucket } from './buckets';
import { defineRoles } from './iam';

export class DevopsStack {
    codeBuildPolicy: iam.ManagedPolicy;


    constructor(private readonly stack: cdk.Stack, private id: string, private props?: cdk.StackProps) {

        /*
          "Statement": [
    {
      "Sid": "CloudWatchLogsPolicy",
      "Effect": "Allow",
      "Action": [
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:PutLogEvents"
      ],
      "Resource": "*"
    },
    {
      "Sid": "CodeCommitPolicy",
      "Effect": "Allow",
      "Action": [
        "codecommit:GitPull"
      ],
      "Resource": "*"
    },
    {
      "Sid": "S3GetObjectPolicy",
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:GetObjectVersion"
      ],
      "Resource": "*"
    },
    {
      "Sid": "S3PutObjectPolicy",
      "Effect": "Allow",
      "Action": [
        "s3:PutObject"
      ],
      "Resource": "*"
    },
    {
      "Sid": "ECRPullPolicy",
      "Effect": "Allow",
      "Action": [
        "ecr:BatchCheckLayerAvailability",
        "ecr:GetDownloadUrlForLayer",
        "ecr:BatchGetImage"
      ],
      "Resource": "*"
    },
    {
      "Sid": "ECRAuthPolicy",
      "Effect": "Allow",
      "Action": [
        "ecr:GetAuthorizationToken"
      ],
      "Resource": "*"
    },
    {
      "Sid": "S3BucketIdentity",
      "Effect": "Allow",
      "Action": [
        "s3:GetBucketAcl",
        "s3:GetBucketLocation"
      ],
      "Resource": "*"
    }
  ]
  */

        // 👇 Create Permissions Boundary
        this.codeBuildPolicy = new iam.ManagedPolicy(
            stack,
            ' CodeBuildServiceRolePolicy',
            {
                statements: [
                    new iam.PolicyStatement({
                        sid: 'CloudWatchLogsPolicy',
                        effect: iam.Effect.ALLOW,
                        actions: ["logs:CreateLogGroup",
                            "logs:CreateLogStream",
                            "logs:PutLogEvents"],
                        resources: ['*'],
                    }),
                    new iam.PolicyStatement({
                        sid: 'CodeCommitPolicy',
                        effect: iam.Effect.ALLOW,
                        actions: ["codecommit:GitPull"],
                        resources: ['*'],
                    }),
                    new iam.PolicyStatement({
                        sid: 'S3GetObjectPolicy',
                        effect: iam.Effect.ALLOW,
                        actions: ["s3:GetObject",
                            "s3:GetObjectVersion"],
                        resources: ['*'],
                    }),
                    new iam.PolicyStatement({
                        sid: 'S3PutObjectPolicy',
                        effect: iam.Effect.ALLOW,
                        actions: ["s3:PutObject"],
                        resources: ['*'],
                    }),
                    new iam.PolicyStatement({
                        sid: "ECRPullPolicy",
                        effect: iam.Effect.ALLOW,
                        actions: ["ecr:BatchCheckLayerAvailability",
                            "ecr:GetDownloadUrlForLayer",
                            "ecr:BatchGetImage"],
                        resources: ['*'],
                    }),
                    new iam.PolicyStatement({
                        sid: "ECRAuthPolicy",
                        effect: iam.Effect.ALLOW,
                        actions: ["ecr:GetAuthorizationToken"],
                        resources: ['*'],
                    }),
                    new iam.PolicyStatement({
                        sid: "S3BucketIdentity",
                        effect: iam.Effect.ALLOW,
                        actions: ["s3:GetBucketAcl",
                            "s3:GetBucketLocation"],
                        resources: ['*'],
                    }),
                ],
            },
        );

    }
}