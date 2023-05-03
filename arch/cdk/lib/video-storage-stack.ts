import * as cdk from 'aws-cdk-lib';

import { aws_s3 as s3 } from 'aws-cdk-lib';

import { moveUnusedVideosToS3IA, removeUnusedVideosLifecyclePolicy } from './iam/policies';
import { createRegularBucket } from './buckets';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';



export class VideoStorageStack extends cdk.Stack {

    customerStorageLow: s3.Bucket;
    videoDistributionBucket: s3.Bucket;
    customerStorageHigh: s3.Bucket;


    constructor(scope: Construct, id: string, props?: cdk.StackProps) {
        super(scope, id, props);
    

        const lowTierBucketName = "customer-storage-lowtier";
        const highTierBucketName = "customer-storage-hightier";

        this.customerStorageLow = createRegularBucket(this, id, lowTierBucketName, "Bucket for uploaded videos -legacy", null, [removeUnusedVideosLifecyclePolicy(30)]);        
        this.customerStorageHigh = createRegularBucket(this, id, highTierBucketName, "Bucket for uploaded videos automatic", null, [removeUnusedVideosLifecyclePolicy(30)]);
        this.videoDistributionBucket = createRegularBucket(this, id, "video-distribution", "Bucket with videos ready to be distributed", null, [moveUnusedVideosToS3IA(60)]);
        // Bind S3 Events to Topic
        //this.uploadVideoBucket.addEventNotification(s3.EventType.OBJECT_CREATED_PUT, new s3n.SnsDestination(this.videoUploadTopic));

        // Create roles for upload in each folder
        this.createStorageRole(lowTierBucketName,"CognitoUserGroupLowTierUploadRole", this.customerStorageLow);
        this.createStorageRole(highTierBucketName,"CognitoUserGroupHighTierUploadRole", this.customerStorageHigh);
        


    }


    createStorageRole(bucketName: string, roleName: string, bucket: s3.Bucket) {

        // 👇 Create ACM Permission Policy
        const storagePolicyForS3 = new iam.PolicyDocument({
            statements: [
                new iam.PolicyStatement({
                    sid: "ManipulateUploadFolderForIdentifiedUsers",
                    effect: iam.Effect.ALLOW,
                    resources: [bucket.bucketArn+ "/upload/*"],
                    actions: [   
                        "s3:GetObject",
                        "s3:PutObject",
                        "s3:PutObjectAcl",
                        "s3:GetObjectAcl",
                        "s3:PutObjectTagging",
                        "s3:PutObjectVersionTagging",
                        "s3:DeleteObject"],
                        conditions: {                              
                            "StringLike": {"s3:prefix": ["${cognito-identity.amazonaws.com:sub}/*"]}
                        }
                }),
            ],
        });        
        // 👇 Create Role
        const role = new iam.Role(this,roleName, {
            assumedBy: new iam.FederatedPrincipal('cognito-identity.amazonaws.com'),
            description: 'Upload role for bucket ' + bucketName,
            inlinePolicies: {
                VideoUploadPolicy: storagePolicyForS3,
            },
            managedPolicies: [
             
            ],
        });
        /**
        new cdk.CfnOutput(this.stack, role.roleName, {
            value: role.roleArn,
            description: "Role to upload data into " + bucketName + " with cognito",
            exportName: role.roleName,
        });
         */
        /**
         *    iam.ManagedPolicy.fromAwsManagedPolicyName(
                    'AmazonAPIGatewayInvokeFullAccess',
                )
         */
    }
}

