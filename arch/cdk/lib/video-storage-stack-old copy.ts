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
        

        createEcsClusterFargate(id: string) {

            //this.videoUploadEventRule.addTarget(new targets.SfnStateMachine(machine: sfn.IStateMachine, props?: SfnStateMachineProps));
            //https://containers-cdk-react-amplify.ws.kabits.com/backend-containers-with-aws-cdk/creating-task/
    
            this.ecsCluster = new ecs.Cluster(this, "VideoProcessingCluster", {
                vpc: this.props.vpc,
                enableFargateCapacityProviders: true,
                containerInsights: true
            });
            this.ecsClusterOutputName = new cdk.CfnOutput(this, 'EcsClusterOutputName', {
                value: this.ecsCluster.clusterName,
                description: 'Name of the ECS Cluster'
            });
            this.ecsClusterOutputArn = new cdk.CfnOutput(this, 'EcsClusterOutputArn', {
                value: this.ecsCluster.clusterArn,
                description: 'ARN of the ECS Cluster'
            });
    
            // https://dev.to/aws-builders/autoscaling-using-spot-instances-with-aws-cdk-ts-4hgh
    
            // Add capacity to it
            this.ecsCluster.addCapacity('DefaultAutoScalingGroupCapacity', {
                instanceType: new ec2.InstanceType(Constants.instanceType),
                desiredCapacity: Constants.default_desired_capacity,
                maxCapacity: Constants.default_max_capacity,
                minCapacity: Constants.default_min_capacity,
                cooldown: Constants.cooldown,
                machineImage: ecs.EcsOptimizedImage.amazonLinux2(),
                spotPrice: "0.0209", // $0.0032 per Hour when writing, $0.0084 per Hour on-d
                vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
                healthCheck: HealthCheck.ec2(),
            });
            this.asg = new AutoScalingGroup(this, "ASG", {
                instanceType: new ec2.InstanceType(Constants.instanceType),
                machineImage: ecs.EcsOptimizedImage.amazonLinux2(),
                associatePublicIpAddress: true,
                maxCapacity: Constants.asg_max_capacity,
                desiredCapacity: Constants.asg_desired_capacity,
                minCapacity: Constants.asg_min_capacity,
                vpc: this.props.vpc,
                vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
                newInstancesProtectedFromScaleIn: false,
                healthCheck: HealthCheck.ec2(),
            })
            const myCapacityProvider = new ecs.AsgCapacityProvider(this, Constants.ASG_PROVIDER, {
                autoScalingGroup: this.asg,
                enableManagedScaling: true,
                enableManagedTerminationProtection: false,
                targetCapacityPercent: Constants.asg_targetCapacityPercent
            });
    
            this.ecsCluster.addAsgCapacityProvider(myCapacityProvider);
            this.ecsCluster.addDefaultCapacityProviderStrategy([
                //            { capacityProvider: "DefaultAutoScalingGroupCapacity", base: Constants.default_max_capacity, weight: 0 },
                // { capacityProvider: Constants.ASG_PROVIDER, base: Constants.asg_max_capacity, weight: 1 },
                { capacityProvider: 'FARGATE', base: 2, weight: 50 },
                { capacityProvider: 'FARGATE_SPOT', weight: 50 },
            ]);
    
            const executionRolePolicy = new iam.PolicyStatement({
                effect: iam.Effect.ALLOW,
                resources: ['*'],
                actions: [
                    "ecr:GetAuthorizationToken",
                    "ecr:BatchCheckLayerAvailability",
                    "ecr:GetDownloadUrlForLayer",
                    "ecr:BatchGetImage",
                    "s3:*",
                    "logs:CreateLogStream",
                    "logs:PutLogEvents"
                ]
            });
            // https://docs.aws.amazon.com/AmazonECS/latest/developerguide/task-cpu-memory-error.html
            this.fargateTaskDefinition = new ecs.FargateTaskDefinition(this, 'ApiTaskDefinition', {
                memoryLimitMiB: Constants.container_memoryLimitMiB,
                cpu: Constants.container_cpu,
                taskRole: this.videoS3Policy,
                ephemeralStorageGiB: Constants.container_ephemeralStorageGiB,
                runtimePlatform: {
                    operatingSystemFamily: ecs.OperatingSystemFamily.LINUX,
                    cpuArchitecture: ecs.CpuArchitecture.X86_64,
                },
            });
            // Permissions allowed to ECS container and fargate agent
            this.fargateTaskDefinition.addToExecutionRolePolicy(executionRolePolicy);
            // Permissions allowed to ECS Containers.
            this.fargateTaskDefinition.addToTaskRolePolicy(new iam.PolicyStatement({
                effect: iam.Effect.ALLOW,
                resources: ['*'],
                actions: ['s3:*']
            }));
    
    
            this.containerDefinition = this.fargateTaskDefinition.addContainer("video-processing", {
                // Use an image from Amazon ECR
                image: ecs.ContainerImage.fromEcrRepository(this.props.ecr_repo),
                logging: ecs.LogDrivers.awsLogs({ streamPrefix: 'video-api' }),
                environment: {
                    INPUT_VIDEO_FILE_URL: "s3://841493508515-upload-bucket/file_example_MP4_1920_18MG.mp4",
                    FFMPEG_OPTIONS: "",
                    OUTPUT_FILENAME: "/tmp/video.mp4",
                    OUTPUT_S3_PATH: this.props.customerStorageLow.s3UrlForObject("/generated/video.mp4"),
                    OUTPUT_BUCKE: "s3://",
                    OUTPUT_VIDEO: "",
                    RESOLUTION: ".160",
                    AWS_REGION: "us-east-1"
                }
                // ... other options here ...
            });
    
            this.containerDefinition.addPortMappings({
                containerPort: 3000
            });
        }
    