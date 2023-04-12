import * as cdk from 'aws-cdk-lib';
import * as sqs from "aws-cdk-lib/aws-sqs";
import * as sns from "aws-cdk-lib/aws-sns";
import * as s3n from "aws-cdk-lib/aws-s3-notifications";
import * as subs from 'aws-cdk-lib/aws-sns-subscriptions';

import { aws_s3 as s3 } from 'aws-cdk-lib';

import { moveUnusedVideosToS3IA, removeUnusedVideosLifecyclePolicy } from './iam/policies';
import { createRegularBucket } from './buckets';



export class VideoStorageStack {

    uploadVideoBucket: s3.Bucket;
    readyVideoBucket: s3.Bucket;
    goldUsersVideoBucket: s3.Bucket;

    constructor(private readonly stack: cdk.Stack, private id: string, private props?: cdk.StackProps) {

        this.uploadVideoBucket = createRegularBucket(stack, id, "legacy-upload-bucket", "Bucket for uploaded videos -legacy", null, [removeUnusedVideosLifecyclePolicy(30)]);        
        this.goldUsersVideoBucket = createRegularBucket(stack, id, "upload-bucket", "Bucket for uploaded videos automatic", null, [removeUnusedVideosLifecyclePolicy(30)]);
        this.readyVideoBucket = createRegularBucket(stack, id, "readyvideo-bucket", "Bucket with ready videos", null, [moveUnusedVideosToS3IA(60)]);
        // Bind S3 Events to Topic
        //this.uploadVideoBucket.addEventNotification(s3.EventType.OBJECT_CREATED_PUT, new s3n.SnsDestination(this.videoUploadTopic));

    }

}