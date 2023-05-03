import * as cdk from 'aws-cdk-lib';
import * as iam from "aws-cdk-lib/aws-iam"

import { aws_s3 as s3, RemovalPolicy } from 'aws-cdk-lib';
import { BlockPublicAccess, BucketEncryption, HttpMethods, LifecycleRule } from 'aws-cdk-lib/aws-s3';
import { removeInvalidUploadPolicy } from '../iam/policies';

/**
    const storageClass: s3.StorageClass = StorageClass.INFREQUENT_ACCESS;
    const tagFilters: s3.Transition = {
      storageClass: storageClass,

      // the properties below are optional
      transitionAfter: cdk.Duration.days(30),
      transitionDate: new Date(),
    };
*/

export function createRegularBucket(stack: cdk.Stack, id: string, name: string, description: string, policy: iam.PolicyStatement | null, lifecycle: LifecycleRule[]) : s3.Bucket {
    const bucket = new s3.Bucket(stack, `${id}-${name}`, {
        bucketName: `${stack.account}-${name}`,
        blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
        encryption: BucketEncryption.S3_MANAGED,
        enforceSSL: true,
        eventBridgeEnabled: true,
        versioned: true,
        removalPolicy: RemovalPolicy.DESTROY,
        publicReadAccess: false,
        lifecycleRules: lifecycle,
        cors: [{
          allowedMethods: [HttpMethods.POST, HttpMethods.GET, HttpMethods.PUT],
          allowedHeaders: ["*"],
          allowedOrigins: [
            "http://localhost:3000",
            "http://localhost"
          ],
          exposedHeaders: ["ETag"]        
        }]
        });
    if (policy) {
        bucket.addToResourcePolicy(policy);
    }
    new cdk.CfnOutput(stack, name, {
        value: bucket.bucketName,
        description: description,
        exportName: name,
    });
    return bucket;
}

export function createBuckets(stack: cdk.Stack, id: string) {
    createRegularBucket(stack, id, "readyvideo-bucket", "Bucket for videos ready to watch", null, [ removeInvalidUploadPolicy(30) ]);
    createRegularBucket(stack, id, "errorvideo-bucket", "Bucket for videos in error", null, [ removeInvalidUploadPolicy(30) ]);
    createRegularBucket(stack, id, "log-bucket", "Bucket for logs", null, [ removeInvalidUploadPolicy(30) ]);
    createRegularBucket(stack, id, "ami-bucket", "Bucket for AMI images", null, [ removeInvalidUploadPolicy(30) ]);

}