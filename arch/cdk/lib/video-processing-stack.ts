import * as cdk from 'aws-cdk-lib';
import * as iam from "aws-cdk-lib/aws-iam";
import * as sqs from "aws-cdk-lib/aws-sqs";
import * as sfn from 'aws-cdk-lib/aws-stepfunctions';
import * as tasks from 'aws-cdk-lib/aws-stepfunctions-tasks';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import { Duration } from 'aws-cdk-lib';
import * as Constants from './model/constants';
import * as batch from 'aws-cdk-lib/aws-batch';
import { aws_s3 as s3 } from 'aws-cdk-lib';

import QueueDefinition from './model/queue-definition';
import { EventField, IEventBus, Rule, RuleTargetInput } from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import { LogGroup, RetentionDays } from 'aws-cdk-lib/aws-logs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { AutoScalingGroup } from "aws-cdk-lib/aws-autoscaling";
import { Construct } from "constructs";
import * as sns from 'aws-cdk-lib/aws-sns';


/** CONSTANTS  */
const jobDefinitionName = "ffmpeg-job-definition";

const jobQueueHighTierName = "video-processing-hightier-queue";
const jobQueueLowTierName = "video-processing-lowtier-queue";
const notificationSNSTopicName = 'NotificationSNS';
const batchInstanceProfileName = "BatchInstanceProfileName"

interface FargateRequirement {
    cpu: number;
    memory: number;
}


const requirements = new Map<number, FargateRequirement>([
    [160, { cpu: 0.5, memory: 1024 } as FargateRequirement],
    [360, { cpu: 1, memory: 2048 } as FargateRequirement],
    [480, { cpu: 1, memory: 3072 } as FargateRequirement],
    [720, { cpu: 2, memory: 4096 } as FargateRequirement],
    [1080, { cpu: 4, memory: 8192 } as FargateRequirement]
]);


export interface VideoProcessStackProps extends cdk.StackProps {
    ecr_repo: cdk.aws_ecr.Repository;
    customerStorageLow: s3.Bucket;
    customerStorageHigh: s3.Bucket;
    videoDistributionBucket: s3.Bucket;
    bus: IEventBus;
    vpc: ec2.Vpc;
}


export class VideoProcessingStack extends cdk.Stack {
    fargateTaskRole: cdk.aws_iam.Role;
    //vpc: cdk.aws_ec2.Vpc;
    videoS3Policy: cdk.aws_iam.PolicyDocument;
    videoS3ManagedPolicies: iam.IManagedPolicy[];
    logGroup: cdk.aws_logs.LogGroup;
    videoUploadEventRule: cdk.aws_events.Rule;
    ecsCluster: cdk.aws_ecs.Cluster;
    stateMachine: sfn.StateMachine;
    asg: AutoScalingGroup;
    fargateTaskDefinition: cdk.aws_ecs.FargateTaskDefinition;
    containerDefinition: cdk.aws_ecs.ContainerDefinition;
    dlqQueueVideoProcessing: sqs.Queue;
    stepFunctionLogGroup: cdk.aws_logs.LogGroup;
    ecsClusterOutputName: cdk.CfnOutput;
    ecsClusterOutputArn: cdk.CfnOutput;
    stsAssumeRoleStatement: iam.PolicyStatement;
    jobSubmitStatement: iam.PolicyStatement;
    batchServiceRole: iam.Role;
    batchInstanceRole: iam.Role;
    sg: cdk.aws_ec2.SecurityGroup;
    jobLowTierQueue: cdk.aws_batch.CfnJobQueue;
    jobHighTierQueue: cdk.aws_batch.CfnJobQueue;
    topic: cdk.aws_sns.Topic;
    taskExecutionRole: cdk.aws_iam.Role;
    taskExecutionRolePolicy: cdk.aws_iam.PolicyDocument;
    batchLogGroup: cdk.aws_logs.LogGroup;
    instanceProfile: cdk.aws_iam.CfnInstanceProfile;
    highTierJobDefinition: cdk.aws_batch.CfnJobDefinition;
    lowTierJobDefinition: cdk.aws_batch.CfnJobDefinition;


    constructor(scope: Construct, id: string, private readonly props: VideoProcessStackProps) {
        super(scope, id, props);

        this.dlqQueueVideoProcessing = this.createStdQueue({
            description: "Queue to handle upload events that have failed to be processed",
            cnfId: "QueueDLQVideoUploadEventTarget",
            name: "QueueDLQVideoUploadEvent"
        });

        this.sg = new ec2.SecurityGroup(this, "sg", {
            securityGroupName: "batch-sg",
            vpc: this.props.vpc
        });

        this.instanceProfile = this.createJobSecurity();

        this.notification();
        this.createBatchJobLowTierQueue();
        this.createBatchJobHighTierQueue();
        this.prepareBatchEnableDisableStateMachine();
        this.prepareVideoProcessingStateMachine()

        this.linkGoldUsersBucketToEventBridge(id);
        this.linkLowUsersBucketToEventBridge(id);
    }

    notification() {
        this.topic = new sns.Topic(this, notificationSNSTopicName);
    }


    createBatchJobLowTierQueue() {

        this.lowTierJobDefinition = this.createDefaultJobDefinition("LowTierJobDefinition");

        const computeEnvironment = this.createFargateComputeEnvironment("LowTierFargateComputeEnv", this.instanceProfile);
        computeEnvironment.state = "DISABLED"
        const computeEnvironmentFarGateSpot = this.createFargateSpotComputeEnvironment("LowTierFargateSpotComputeEnv", this.instanceProfile);
        computeEnvironmentFarGateSpot.state = "DISABLED"

        this.jobLowTierQueue = new batch.CfnJobQueue(this, jobQueueLowTierName, {
            jobQueueName: jobQueueLowTierName,
            priority: 1,
            state: "ENABLED",
            computeEnvironmentOrder: [
                { order: 1, computeEnvironment: computeEnvironmentFarGateSpot.computeEnvironmentName as string },
                { order: 2, computeEnvironment: computeEnvironment.computeEnvironmentName as string },
            ]
        });
        this.jobLowTierQueue.addDependsOn(computeEnvironment);
        this.jobLowTierQueue.addDependsOn(computeEnvironmentFarGateSpot);
    }


    createBatchJobHighTierQueue() {

        this.highTierJobDefinition = this.createDefaultJobDefinition("HighTierJobDefinition");

        const computeEnvironment = this.createFargateComputeEnvironment("HighTierFargateComputeEnv", this.instanceProfile);
        const computeEnvironmentFarGateSpot = this.createFargateSpotComputeEnvironment("HighTierFargateSpotComputeEnv", this.instanceProfile);

        this.jobHighTierQueue = new batch.CfnJobQueue(this, jobQueueHighTierName, {
            jobQueueName: jobQueueHighTierName,
            priority: 1,
            state: "ENABLED",
            computeEnvironmentOrder: [
                { order: 1, computeEnvironment: computeEnvironmentFarGateSpot.computeEnvironmentName as string },
                { order: 2, computeEnvironment: computeEnvironment.computeEnvironmentName as string },
            ]
        });
        this.jobHighTierQueue.addDependsOn(computeEnvironment);
        this.jobHighTierQueue.addDependsOn(computeEnvironmentFarGateSpot);
    }



    private createFargateComputeEnvironment(computeEnvName: string, instanceProfile: cdk.aws_iam.CfnInstanceProfile) {
        const computeEnvironment = new batch.CfnComputeEnvironment(this, computeEnvName, {
            computeEnvironmentName: computeEnvName,
            computeResources: {
                maxvCpus: Constants.maxvCpus,
                type: "FARGATE",
                subnets: this.props.vpc.publicSubnets.map(x => x.subnetId),
                securityGroupIds: [this.sg.securityGroupId]
            },
            serviceRole: this.batchServiceRole.roleArn,
            type: "MANAGED",
            state: "ENABLED"
        });
        computeEnvironment.addDependsOn(instanceProfile);
        return computeEnvironment;
    }


    private createFargateSpotComputeEnvironment(computeEnvName: string, instanceProfile: cdk.aws_iam.CfnInstanceProfile) {

        const computeEnvironmentFarGateSpot = new batch.CfnComputeEnvironment(this, computeEnvName, {
            computeEnvironmentName: computeEnvName,
            computeResources: {
                maxvCpus: Constants.maxvCpusfargateSpot,
                type: "FARGATE_SPOT",
                subnets: this.props.vpc.publicSubnets.map(x => x.subnetId),
                securityGroupIds: [this.sg.securityGroupId]
            },
            serviceRole: this.batchServiceRole.roleArn,
            type: "MANAGED",
            state: "ENABLED"
        });
        computeEnvironmentFarGateSpot.addDependsOn(instanceProfile);
        return computeEnvironmentFarGateSpot;
    }

    private createJobSecurity() {
        this.stsAssumeRoleStatement = new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: ["sts:AssumeRole"],
            resources: ["*"]
        });

        this.jobSubmitStatement = new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: ["batch:SubmitJob"],
            resources: ["*"]
        });

        this.batchServiceRole = new iam.Role(this, "service-role", {
            assumedBy: new iam.ServicePrincipal("batch.amazonaws.com"),
            managedPolicies: [iam.ManagedPolicy.fromAwsManagedPolicyName("service-role/AWSBatchServiceRole")],
        });
        this.batchServiceRole.addToPolicy(this.stsAssumeRoleStatement);

        this.batchInstanceRole = new iam.Role(this, "instance-role", {
            assumedBy: new iam.ServicePrincipal("ec2.amazonaws.com"),
            managedPolicies: [iam.ManagedPolicy.fromAwsManagedPolicyName("service-role/AmazonEC2ContainerServiceforEC2Role")],
        });
        this.batchInstanceRole.addToPolicy(this.stsAssumeRoleStatement);

        const instanceProfile = new iam.CfnInstanceProfile(this, batchInstanceProfileName, {
            instanceProfileName: batchInstanceProfileName,
            roles: [
                this.batchInstanceRole.roleName
            ]
        });

        this.videoS3Policy = new iam.PolicyDocument({
            statements: [
                new iam.PolicyStatement({
                    sid: "AllowS3AccessAndLogs",
                    effect: iam.Effect.ALLOW,
                    actions: ['s3:*',
                        "logs:CreateLogStream",
                        "logs:CreateLogGroup",
                        "logs:PutLogEvents"],
                    resources: ['*'],
                })
            ],
        });


        this.taskExecutionRolePolicy = new iam.PolicyDocument({
            statements: [
                new iam.PolicyStatement({
                    sid: "ECRAccess",
                    effect: iam.Effect.ALLOW,
                    actions: [
                        "ecr:GetAuthorizationToken",
                        "ecr:BatchCheckLayerAvailability",
                        "ecr:GetDownloadUrlForLayer",
                        "ecr:BatchGetImage",
                        "logs:CreateLogGroup",
                        "logs:CreateLogStream",
                        "logs:PutLogEvents"],
                    resources: ['*'],
                })
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

        /**
         * Define permissions allowed for the Docker process
         */
        this.fargateTaskRole = new iam.Role(this, 'FargateJobRole', {
            assumedBy: new iam.CompositePrincipal(
                new iam.ServicePrincipal("ec2.amazonaws.com"),
                new iam.ServicePrincipal("ecs.amazonaws.com"),
                new iam.ServicePrincipal("ecs-tasks.amazonaws.com")
            ),
            description: 'This role is used by services that requires to manipulate the S3 video buckets',
            inlinePolicies: {
                VideoS3Policy: this.videoS3Policy,
            },
            managedPolicies: this.videoS3ManagedPolicies,
        });
        /**
         * Permissions offered to services to hava access to this job def.
         */
        this.taskExecutionRole = new iam.Role(this, 'FargateTaskExecutionRole', {
            assumedBy: new iam.CompositePrincipal(
                new iam.ServicePrincipal("ec2.amazonaws.com"),
                new iam.ServicePrincipal("ecs.amazonaws.com"),
                new iam.ServicePrincipal("ecs-tasks.amazonaws.com")
            ),
            description: 'This role defines the permississions of ECS and ECS tasks',
            inlinePolicies: {
                TaskExecutionRolePolicy: this.taskExecutionRolePolicy,
            }
        });
        return instanceProfile;
    }

    private createDefaultJobDefinition(jobDefinitionName: string): batch.CfnJobDefinition {
        const jobDefinition = new batch.CfnJobDefinition(this, jobDefinitionName, {
            jobDefinitionName,
            platformCapabilities: ["FARGATE"],
            propagateTags: true,
            type: "Container",
            containerProperties: {
                logConfiguration: {
                    logDriver: "awslogs",
                    options: {
                        "awslogs-region": "us-east-1",
                        //"awslogs-datetime-format": '[%b %d, %Y %H:%M:%S]',
                        "awslogs-group": "/aws/batch/job/executions",
                        "awslogs-create-group": "true"
                    }
                },
                // Use an image from Amazon ECR
                image: ecs.ContainerImage.fromEcrRepository(this.props.ecr_repo).imageName,
                //logConfiguration: ecs.LogDrivers.awsLogs({ streamPrefix: 'video-api' }),
                environment: [
                    { name: "INPUT_VIDEO_FILE_URL", value: "s3://841493508515-upload-bucket/file_example_MP4_1920_18MG.mp4" },
                    { name: "FFMPEG_OPTIONS", value: "" },
                    { name: "OUTPUT_FILENAME", value: "/tmp/video.mp4" },
                    { name: "OUTPUT_BUCKET", value: this.props.videoDistributionBucket.bucketName, },
                    { name: "OUTPUT_VIDEO", value: "" },
                    { name: "RESOLUTION", value: "160" },
                    { name: "ECS_ENABLE_AWSLOGS_EXECUTIONROLE_OVERRIDE", value: "true" },
                    { name: "AWS_REGION", value: "us-east-1" }
                ],
                jobRoleArn: this.fargateTaskRole.roleArn,
                executionRoleArn: this.taskExecutionRole.roleArn,
                resourceRequirements: [
                    {
                        value: '2048',
                        type: 'MEMORY'
                    },
                    {
                        value: '1.0',
                        type: 'VCPU'
                    }
                ],
            },
            retryStrategy: {
                attempts: 1

            },
            /**
            timeout: {
                attemptDurationSeconds: 60 * 30
            }
             */
        });
        return jobDefinition;
    }



    /**
     * Link the S3 events from the customer storage gold tier bucket to EventBridge with a rule.
     * The targets are StepFunctions, SNS and LogGroup
     * @param id 
     */
    linkGoldUsersBucketToEventBridge(id: string) {



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
        this.logGroup = new LogGroup(this, 'VidepUploadLogGroup', {
            logGroupName: `/watchflix/events/video-upload-events`,
            retention: RetentionDays.ONE_MONTH
        });
        this.batchLogGroup = new LogGroup(this, 'BatchJobExecutionLogGroup', {
            logGroupName: `/aws/batch/job/executions`,
            retention: RetentionDays.ONE_MONTH
        });



        const eventPattern = {
            detailType: ["Object Created"],
            source: ["aws.s3"],
            detail: {
                bucket: {
                    name: [this.props.customerStorageHigh.bucketName]
                },
                object: {
                    key: [{ "exists": true }],
                    size: [{ "exists": true }]
                }
            }
        };
        // Let's send the events both to step functions and logs.
        this.videoUploadEventRule = new Rule(this, 'GoldTierBucketUploadEventRule', {
            ruleName: `${id}-${this.props.bus.eventBusName}-goldtierbucket-upload-eventrule`,
            description: 'Rule matching S3 video upload events',
            eventBus: this.props.bus,
            eventPattern,
        });

        this.videoUploadEventRule.addTarget(new targets.CloudWatchLogGroup(
            this.logGroup
        ));
        const inputTransformer = this.buildInputTransformer('gold');

        this.videoUploadEventRule.addTarget(new targets.SfnStateMachine(
            this.stateMachine,
            {
                input: RuleTargetInput.fromObject(inputTransformer),
                //default event input:
                retryAttempts: 185,
                maxEventAge: Duration.hours(24),
                deadLetterQueue: this.dlqQueueVideoProcessing
            }
        ));

        this.videoUploadEventRule.addTarget(
            new targets.SnsTopic(this.topic)
        );
    }


    private buildInputTransformer(customerTier: string) {
        return {
            _eventId: "VideoUploadEvent",
            bucket: EventField.fromPath("$.detail.bucket.name"),
            video: EventField.fromPath("$.detail.object.key"),
            url: "s3://" + EventField.fromPath("$.detail.bucket.name") + "/" + EventField.fromPath("$.detail.object.key"),
            size: EventField.fromPath("$.detail.object.size"),
            customer : EventField.fromPath("$.detail.request-id"),
            customerTier
        };
    }

    /**
     * Link the S3 events from the customer storage gold tier bucket to EventBridge with a rule.
     * The targets are StepFunctions, SNS and LogGroup
     * @param id 
     */
    linkLowUsersBucketToEventBridge(id: string) {



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
        this.logGroup = new LogGroup(this, 'VideoUploadLowTierLogGroup', {
            logGroupName: `/watchflix/events/lowtier/video-upload-events`,
            retention: RetentionDays.ONE_MONTH
        });
        this.batchLogGroup = new LogGroup(this, 'BatchJobExecutionLowTierLogGroup', {
            logGroupName: `/aws/batch/job/lowtier/executions`,
            retention: RetentionDays.ONE_MONTH
        });


        const eventPattern = {
            detailType: ["Object Created"],
            source: ["aws.s3"],
            detail: {
                bucket: {
                    name: [this.props.customerStorageLow.bucketName]
                },
                object: {
                    key: [{ "exists": true }],
                    size: [{ "exists": true }]
                }
            }
        };
        // Let's send the events both to step functions and logs.
        this.videoUploadEventRule = new Rule(this, 'LowTierBucketUploadEventRule', {
            ruleName: `${id}-${this.props.bus.eventBusName}-lowtierbucket-upload-eventrule`,
            description: 'Rule matching S3 video upload events for low tier users',
            eventBus: this.props.bus,
            eventPattern,
        });

        this.videoUploadEventRule.addTarget(new targets.CloudWatchLogGroup(
            this.logGroup
        ));
        const inputTransformer = this.buildInputTransformer('silver');

        this.videoUploadEventRule.addTarget(new targets.SfnStateMachine(
            this.stateMachine,
            {
                input: RuleTargetInput.fromObject(inputTransformer),
                //default event input:
                retryAttempts: 185,
                maxEventAge: Duration.hours(24),
                deadLetterQueue: this.dlqQueueVideoProcessing
            }
        ));

        this.videoUploadEventRule.addTarget(
            new targets.SnsTopic(this.topic)
        );
    }


    prepareBatchEnableDisableStateMachine() {
        const BatchSupportPolicy = new iam.PolicyDocument({
            statements: [
                new iam.PolicyStatement({
                    sid: "AllowBatchSupportPolicy",
                    effect: iam.Effect.ALLOW,
                    actions: ['batch:*',
                        "logs:CreateLogDelivery",
                        "logs:GetLogDelivery",
                        "logs:UpdateLogDelivery",
                        "logs:DeleteLogDelivery",
                        "logs:ListLogDeliveries",
                        "logs:PutResourcePolicy",
                        "logs:DescribeResourcePolicies",
                        "logs:DescribeLogGroups"],
                    resources: ['*'],
                })
            ]
        });

        this.batchServiceRole = new iam.Role(this, "BatchServiceRole", {
            assumedBy: new iam.ServicePrincipal("states.us-east-1.amazonaws.com"),
            inlinePolicies: {
                batchServicePolicy: BatchSupportPolicy,
            },
        });



        /**    this.stepFunctionLogGroup = new LogGroup(this, 'NightlyBatchStateLogGroup', {
                logGroupName: `/watchflix/events/nightly-batch-state`,
                retention: RetentionDays.ONE_MONTH
            });
    
            tasks.
            // Create notification  steps
            const beginBatchNotificationStep = new tasks.SnsPublish(this, 'BeginBatchNotificationStep', {
                topic: this.topic,
                message: sfn.TaskInput.fromObject({"message" : "Enable the processing of low-tier videos"}),
            });
    
            new tasks.
    
            const endBatchNotificationStep = new tasks.SnsPublish(this, 'EndBatchNotificationStep', {
                topic: this.topic,
                message: sfn.TaskInput.fromObject({"message" : "disable the processing of low-tier videos"}),
            });
      
    
            this.stateMachine = new sfn.StateMachine(this, 'VideoProcessingStackMachine', {
                definition: definition,
                timeout: Duration.hours(4),
                stateMachineName: "VideoProcessingStateMachine",
                tracingEnabled: true,
                logs: {
                    level: sfn.LogLevel.ALL,
                    includeExecutionData: true,
                    destination: this.stepFunctionLogGroup
                }
            });
             */
    }

    /**
     * {
  "input": {
    "_eventId": "VideoUploadEvent",
    "bucket": "841493508515-upload-bucket",
    "video": "customer-abc/5.mp4",
    "url": "s3://841493508515-upload-bucket/customer-abc/5.mp4",
    "size": 541
  },
  "inputDetails": {
    "truncated": false
  },
  "roleArn": "arn:aws:iam::841493508515:role/CloudVpcStack-VideoProcessingStackMachineRole6773A-1JCZ3AFTEMMAB",
  "stateMachineAliasArn": null,
  "stateMachineVersionArn": null
}
     */
    prepareVideoProcessingStateMachine() {
        this.stepFunctionLogGroup = new LogGroup(this, 'StepFunctionLoadGroup', {
            logGroupName: `/watchflix/events/stepfunction-video`,
            retention: RetentionDays.ONE_MONTH
        });

        const succeedStep = new sfn.Succeed(this, "EncodingPerformed");

        // Create notification  steps
        const errorNotificationStep = new tasks.SnsPublish(this, 'ErrorNotificationStep', {
            topic: this.topic,
            message: sfn.TaskInput.fromJsonPathAt('$.Cause'),
        });
        errorNotificationStep.next(new sfn.Fail(this, "FailureState", {
            cause: "One or more format of the video have not been generated",
            error: "1024",
            comment: "One or more format of the video have not been generated"
        }));
        const successNotificationStep = new tasks.SnsPublish(this, 'SuccessNotificationStep', {
            topic: this.topic,
            message: sfn.TaskInput.fromObject({ "message": "All the videos have been generated" })
        });
        successNotificationStep.next(succeedStep);

        // Video encoding tasks
        const catchOptions: sfn.CatchProps = {
            errors: [sfn.Errors.ALL]
        };
        const parallelLowTier = new sfn.Parallel(this, "ParallelEncodingActivityForLowTier", { comment: "Orchestrate parallel encoding activity" })
        parallelLowTier.branch(
            this.encodingBatch("Low", this.jobLowTierQueue,this.lowTierJobDefinition, 160),
            this.encodingBatch("Low", this.jobLowTierQueue, this.lowTierJobDefinition, 360)
        );

        const parallelGoldTier = new sfn.Parallel(this, "ParallelEncodingActivityForGoldTier", { comment: "Orchestrate parallel encoding activity" })
        parallelGoldTier.branch(
            this.encodingBatch("High", this.jobHighTierQueue, this.highTierJobDefinition, 160),
            this.encodingBatch("High", this.jobHighTierQueue, this.highTierJobDefinition, 360),
            this.encodingBatch("High", this.jobHighTierQueue, this.highTierJobDefinition, 480),
            this.encodingBatch("High", this.jobHighTierQueue, this.highTierJobDefinition, 720),
            this.encodingBatch("High", this.jobHighTierQueue, this.highTierJobDefinition, 1080),
        );

        

        parallelGoldTier
            .addCatch(errorNotificationStep, catchOptions)
            .next(successNotificationStep)
            
        parallelLowTier
            .addCatch(errorNotificationStep, catchOptions)
            .next(successNotificationStep)
            




        // Initial state
        const choice = new sfn.Choice(this, "CustomerCategoryProcessingChoice", {
            comment: "perform treatement based on customer tier",
        });
        choice.when(
            sfn.Condition.stringEquals('$.customerTier', 'gold'),
            parallelGoldTier
        ).otherwise(parallelLowTier)



        // Root of the state machine
        const definition = choice;
        //
        this.stateMachine = new sfn.StateMachine(this, 'VideoProcessingStackMachine', {
            definition: definition,
            timeout: Duration.hours(4),
            stateMachineName: "VideoProcessingStateMachine",
            tracingEnabled: true,
            logs: {
                level: sfn.LogLevel.ALL,
                includeExecutionData: true,
                destination: this.stepFunctionLogGroup
            }
        });
    }



    encodingBatch(prefix: string, jobQueue: cdk.aws_batch.CfnJobQueue, jobDefinition: cdk.aws_batch.CfnJobDefinition, resolution: number): cdk.aws_stepfunctions.IChainable {
        const resolutionSettings = requirements.get(resolution);
        if (resolutionSettings === undefined) {
            throw new Error("Resolution " + resolution + " is undefined");
        }
        return new tasks.BatchSubmitJob(this, 'InvokeFFMpegUsingBatch' + prefix + "_"+ resolution, {
            jobDefinitionArn: jobDefinition.ref,
            //jobName: "States.Format('InvokeFFMpeg_resolution_"+ prefix + "_" + resolution+"_{}', $.customer)",
            jobName: "InvokeFFMpeg_resolution_"+ prefix + "_" + resolution,
            jobQueueArn: jobQueue.attrJobQueueArn,
            attempts: 1,
            comment: "Generation de video en resolution " + resolution,
            containerOverrides: {
                memory: cdk.Size.mebibytes(resolutionSettings.memory),
                vcpus: resolutionSettings.cpu,
                environment: {
                    'INPUT_VIDEO_FILE_URL': sfn.JsonPath.stringAt('$.url'),
                    'FFMPEG_OPTIONS': " -vf scale=-2:" + resolution + " -crf 18 -preset slow -c:a copy ",
                    'OUTPUT_FILENAME': "/tmp/video" + resolution + ".mp4", // temporary file
                    'OUTPUT_BUCKET': this.props.videoDistributionBucket.bucketName,
                    'OUTPUT_VIDEO': sfn.JsonPath.stringAt('$.video'),
                    'RESOLUTION': resolution.toString(),
                    'AWS_REGION': "us-east-1",
                    "ECS_ENABLE_AWSLOGS_EXECUTIONROLE_OVERRIDE": "true"
                },
            },
        });
    }


    private createStdQueue(def: QueueDefinition): cdk.aws_sqs.Queue {
        const queue = new sqs.Queue(this, def.name);
        new cdk.CfnOutput(this, def.cnfId, {
            value: queue.queueArn,
            description: def.description
        })
        return queue;
    }

}