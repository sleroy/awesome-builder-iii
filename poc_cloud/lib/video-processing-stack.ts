import * as cdk from 'aws-cdk-lib';
import * as ec2 from "aws-cdk-lib/aws-ec2"
import * as iam from "aws-cdk-lib/aws-iam"
import * as ecs from "aws-cdk-lib/aws-ecs"

// unprocessedVideosBucket.arnForObjects('*')
import { aws_s3 as s3, RemovalPolicy } from 'aws-cdk-lib';

import { Bucket } from 'aws-cdk-lib/aws-s3';
import { VideoStorageStack } from './video-storage-stack';


export class VideoProcessingStack {
    s3VideoRole: cdk.aws_iam.Role;
    vpc: cdk.aws_ec2.Vpc;
    videoS3Policy: cdk.aws_iam.PolicyDocument;
    videoS3ManagedPolicies: iam.IManagedPolicy[];


    constructor(private readonly stack: cdk.Stack, private id: string, private videoStorageStack: VideoStorageStack, private props?: cdk.StackProps) {

        /** VPC Definition */
        this.vpc = new ec2.Vpc(stack, "CloudVpc", {
            maxAzs: 3 // Default is all AZs in region
        });

        // Video S3 Role
        // Create ACM Permission Policy
        this.videoS3Policy = new iam.PolicyDocument({
            statements: [
                new iam.PolicyStatement({
                    effect: iam.Effect.ALLOW,
                    actions: ['s3:*'],
                    resources: ['*'],
                }),
            ],
        });

        /**
        const videoS3ManagedPolicies = [
          iam.ManagedPolicy.fromAwsManagedPolicyName(
            'AmazonAPIGatewayInvokeFullAccess',
          ),
        ];
         */
        this.videoS3ManagedPolicies = [
        ];

        this.s3VideoRole = new iam.Role(stack, 'iam-s3-video-role', {
            assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
            description: 'This role is used by services that requires to manipulate the S3 video buckets',
            inlinePolicies: {
                VideoS3Policy: this.videoS3Policy,
            },
            managedPolicies: this.videoS3ManagedPolicies,
        });
    }

}