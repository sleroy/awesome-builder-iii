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

interface QueueDefinition {
    cnfId: string,
    name: string,
    description: string,
    maxReceiveCount?: number
}


export class VideoStorageStack {

    videoProcLambdaQueue: sqs.Queue;
    videoProcStdQueue: sqs.Queue;
    videoErrorQueue: cdk.aws_sqs.Queue;
    videoRegistrationQueue: cdk.aws_sqs.Queue;
    videoUploadTopic: cdk.aws_sns.Topic;
    uploadVideoBucket: s3.Bucket;
    videoProcessingLambda: cdk.aws_lambda.Function;
    snsTopicPolicy: cdk.aws_iam.PolicyStatement;

    constructor(private readonly stack: cdk.Stack, private id: string, private props?: cdk.StackProps) {

        this.videoErrorQueue = this.createStdQueue(
            {
                cnfId: "VideoErrorQueue",
                name: 'video-errors-queue',
                description: "Queue for processing videos in errors"
            }
        )

        this.videoProcLambdaQueue = this.createQueueWithDLQ(
            {
                cnfId: "VideoProcessingLambdaQueue",
                name: 'video-processing-lambda-queue',
                description: "Queue for processing videos using Lambda"
            },
            this.videoErrorQueue
        )

        this.videoProcStdQueue = this.createQueueWithDLQ(
            {
                cnfId: "VideoProcessingStdQueue",
                name: 'video-processing-std-queue',
                description: "Queue for processing (long) videos"
            },
            this.videoErrorQueue
        )


        this.videoRegistrationQueue = this.createStdQueue(
            {
                cnfId: "VideoRegistrationQueue",
                name: 'video-registration-queue',
                description: "Queue for registering videos"
            }
        )


        // 👇 create sns topic
        this.videoUploadTopic = new sns.Topic(stack, 'video-upload-topic', {
            displayName: "Received video upload events"
        });
        // Create bucket s3 event to notify when a video has been uploaded
        /**
         * {
  "Type" : "Notification",
  "MessageId" : "272d9fc3-646b-549f-a3e6-c35a6f0a90f6",
  "TopicArn" : "arn:aws:sns:us-east-1:841493508515:CloudVpcStack-videouploadtopic481D0135-mGHM8J0uaMV6",
  "Subject" : "Amazon S3 Notification",
  "Message" : "{\"Service\":\"Amazon S3\",\"Event\":\"s3:TestEvent\",\"Time\":\"2023-03-25T14:45:53.137Z\",\"Bucket\":\"841493508515-uploaded-bucket\",\"RequestId\":\"J2YJ85ARECFTZDZP\",\"HostId\":\"bTo0sDnSlhV0Fs91soMTF2ucnFXvWDgH+GbDUqu2f//r9c4nOVIS3PUf6AFiZQOWbWgVHPfaqXg=\"}",
  "Timestamp" : "2023-03-25T14:45:53.157Z",
  "SignatureVersion" : "1",
  "Signature" : "q4MRJ+P3eplwys89pdrFNvlrAYd0HhELNsmkM5SvrLAmW9QFJEvUB2FgPOzxJ4j2Vb5tiBzijUUihz7FdsOXnMcNcrnJyDs/PwpU/9pLK1DuO0BrKCpgHJtHBuz7EuaNNNQr7wI+b9WTTOowr5Kve7ajq2M9WvNBeYhZ2tZyJ737xbStAi9Qhscfw2SH+lQylqgj4Qe7QEhdxzR4HwseZo4v1BQhYlChp78A1OG/pVPhximvv3HWYyRaAHv55InOt1gecfjKrLKDOHr+jbf0a2jqDd6VksZP0/P2HWgd64HjjpGh33Bo2aSy2rLqFu7WbSoWWCpKp8bNYwL0QAvhog==",
  "SigningCertURL" : "https://sns.us-east-1.amazonaws.com/SimpleNotificationService-56e67fcb41f6fec09b0196692625d385.pem",
  "UnsubscribeURL" : "https://sns.us-east-1.amazonaws.com/?Action=Unsubscribe&SubscriptionArn=arn:aws:sns:us-east-1:841493508515:CloudVpcStack-videouploadtopic481D0135-mGHM8J0uaMV6:81115bba-64df-415d-badc-9879d45fd96e"
}
         */

        // "price_usd": [{"numeric": ["=",301.5]}]


        this.uploadVideoBucket = createRegularBucket(stack, id, "upload-bucket", "Bucket for uploaded videos", null, [removeUnusedVideosLifecyclePolicy(30)]);
        // Bind S3 Events to Topic
        this.uploadVideoBucket.addEventNotification(s3.EventType.OBJECT_CREATED_PUT, new s3n.SnsDestination(this.videoUploadTopic));


        // Bind topic to consumers
        /*
        {
  "Records": {
    "s3": {
      "object": {
        "size": [{"numeric": ["<", 1000000000]}]
      }
    }
  }
}*/
        const sqsProps: subs.SqsSubscriptionProps = {
            filterPolicyWithMessageBody: {
                Records: sns.FilterOrPolicy.policy({
                    s3: sns.FilterOrPolicy.policy({
                        object: sns.FilterOrPolicy.policy({
                            size: sns.FilterOrPolicy.filter(sns.SubscriptionFilter.numericFilter({
                                between: { start: 0, stop: 20 * 1024 * 1024 }
                            })
                            )
                        }),
                    }),
                })
            }
        };
        this.videoUploadTopic.addSubscription(new subs.SqsSubscription(this.videoProcLambdaQueue, sqsProps));
        this.videoUploadTopic.addSubscription(new subs.SqsSubscription(this.videoProcStdQueue));

    }

    private createStdQueue(def: QueueDefinition): cdk.aws_sqs.Queue {
        const queue = new sqs.Queue(this.stack, def.name);
        new cdk.CfnOutput(this.stack, def.cnfId, {
            value: queue.queueArn,
            description: def.description
        })
        return queue;
    }

    private createQueueWithDLQ(def: QueueDefinition, deadLetterQueue: cdk.aws_sqs.Queue): cdk.aws_sqs.Queue {
        const queue = new sqs.Queue(this.stack, def.name, {
            queueName: def.name,
            deadLetterQueue: {
                queue: deadLetterQueue,
                maxReceiveCount: def.maxReceiveCount ?? 3
            }
        });
        new cdk.CfnOutput(this.stack, def.cnfId, {
            value: queue.queueArn,
            description: def.description ?? ""
        });
        return queue;


    }
}


        /** VPC Definition */
/**        this.vpc = new ec2.Vpc(stack, "CloudVpc", {
            maxAzs: 3 // Default is all AZs in region
        });**/

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

        this.videoProcLambdaQueue = this.createQueueWithDLQ(
            {
                cnfId: "VideoProcessingLambdaQueue",
                name: 'video-processing-lambda-queue',
                description: "Queue for processing videos using Lambda"
            },
            this.videoErrorQueue
        )

        this.videoProcStdQueue = this.createQueueWithDLQ(
            {
                cnfId: "VideoProcessingStdQueue",
                name: 'video-processing-std-queue',
                description: "Queue for processing (long) videos"
            },
            this.videoErrorQueue
        )



    
        this.videoProcessingLambda = new lambda.Function(stack, 'VideoProcessingLambda', {
            runtime: lambda.Runtime.PYTHON_3_9,
            code: lambda.Code.fromAsset('lambda'),
            handler: 'VideoProcessingLambda.handler',
            environment: { 'SNS_ARN': videoStorageStack.videoUploadTopic.topicArn, },
        });
        
        
        //this.videoProcessingLambda.addToRolePolicy(this.snsTopicPolicy);
        