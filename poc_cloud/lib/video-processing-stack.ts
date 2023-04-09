import * as cdk from 'aws-cdk-lib';
import * as iam from "aws-cdk-lib/aws-iam";
import * as sqs from "aws-cdk-lib/aws-sqs";

// unprocessedVideosBucket.arnForObjects('*')

import { VideoStorageStack } from './video-storage-stack';
import QueueDefinition from './queue-definition';
import { EventBus, Rule } from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import { LogGroup, RetentionDays } from 'aws-cdk-lib/aws-logs';


export class VideoProcessingStack {
    s3VideoRole: cdk.aws_iam.Role;
    //vpc: cdk.aws_ec2.Vpc;
    videoS3Policy: cdk.aws_iam.PolicyDocument;
    videoS3ManagedPolicies: iam.IManagedPolicy[];
    logGroup: cdk.aws_logs.LogGroup;
    videoUploadEventRule: cdk.aws_events.Rule;
    stateMachineTarget: any;



    constructor(private readonly stack: cdk.Stack, private id: string, private videoStorageStack: VideoStorageStack, private bus: EventBus, private props?: cdk.StackProps) {

        this.prepareStateMachine()


        // Créer le lien s3 vers eventBridge
        /**
         * Sample Events
         * {
  "version": "0",
  "id": "17793124-05d4-b198-2fde-7ededc63b103",
  "detail-type": "Object Created",
  "source": "aws.s3",
  "account": "123456789012",
  "time": "2021-11-12T00:00:00Z",
  "region": "ca-central-1",
  "resources": ["arn:aws:s3:::example-bucket"],
  "detail": {
    "version": "0",
    "bucket": {
      "name": "example-bucket"
    },
    "object": {
      "key": "example-key",
      "size": 5,
      "etag": "b1946ac92492d2347c6235b4d2611184",
      "version-id": "IYV3p45BT0ac8hjHg1houSdS1a.Mro8e",
      "sequencer": "00617F08299329D189"
    },
    "request-id": "N4N7GDK58NMKJ12R",
    "requester": "123456789012",
    "source-ip-address": "1.2.3.4",
    "reason": "PutObject"
  }
}
         */
        // cloudwatch log group target
        this.logGroup = new LogGroup(stack, 'VidepUploadLogGroup', {
            logGroupName: `/aws/events/video-upload-events`,
            retention: RetentionDays.ONE_DAY
        });

        // Let's send the events both to step functions and logs.
        this.videoUploadEventRule = new Rule(stack, 'VideoUploadS3Event', {
            ruleName: `${id}-videoupload-rule`,
            description: 'Rule matching S3 video upload events',
            eventBus: this.bus,
            eventPattern: {
                source: ["aws.s3"],
                detailType: ["Object Created"],
                detail: {
                    bucket: {
                        name: [videoStorageStack.uploadVideoBucket.bucketName]
                    }
                }
            },
        });
        this.videoUploadEventRule.addTarget(new targets.CloudWatchLogGroup(
            this.logGroup
        ));

        // Attach the step function
        this.videoUploadEventRule.addTarget(new targets.SfnStateMachine(machine: sfn.IStateMachine, props?: SfnStateMachineProps));

        //videoStorageStack.uploadVideoBucket.on
        // Creer une rule
        /**     this.videoErrorQueue = this.createStdQueue(
                    {
                        cnfId: "VideoErrorStdQueue",
                        name: 'video-errors-std-queue',
                        description: "Queue for processing videos in errors"
                    }
                )
                this.videoProcStdQueue = this.createQueueWithDLQ(
                    {
                        cnfId: "VideoProcessingStdQueue",
                        name: 'video-processing-std-queue',
                        description: "Queue for processing (long) videos"
                    },
                    this.videoErrorQueue
                )
         */


    }
    prepareStateMachine() {

        
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