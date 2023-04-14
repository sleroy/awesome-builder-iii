import * as iam from "aws-cdk-lib/aws-iam";
import * as sqs from "aws-cdk-lib/aws-sqs";
import * as cdk from 'aws-cdk-lib';
import * as sfn from 'aws-cdk-lib/aws-stepfunctions';
import * as tasks from 'aws-cdk-lib/aws-stepfunctions-tasks';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import { Duration } from 'aws-cdk-lib';
import * as Constants from './constants'

// unprocessedVideosBucket.arnForObjects('*')

import { VideoStorageStack } from './video-storage-stack';
import QueueDefinition from './queue-definition';
import { EventField, IEventBus, Rule, RuleTargetInput } from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import { LogGroup, RetentionDays } from 'aws-cdk-lib/aws-logs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { DevopsStack } from './devops-stack';
import { AutoScalingGroup, HealthCheck } from "aws-cdk-lib/aws-autoscaling";


export class VideoProcessingStack {
    s3VideoRole: cdk.aws_iam.Role;
    //vpc: cdk.aws_ec2.Vpc;
    videoS3Policy: cdk.aws_iam.PolicyDocument;
    videoS3ManagedPolicies: iam.IManagedPolicy[];
    logGroup: cdk.aws_logs.LogGroup;
    videoUploadEventRule: cdk.aws_events.Rule;
    vpc: ec2.Vpc;
    ecsCluster: cdk.aws_ecs.Cluster;
    stateMachine: sfn.StateMachine;
    asg: AutoScalingGroup;
    fargateTaskDefinition: cdk.aws_ecs.FargateTaskDefinition;
    containerDefinition: cdk.aws_ecs.ContainerDefinition;
    dlqQueueVideoProcessing: sqs.Queue;
    stepFunctionLogGroup: cdk.aws_logs.LogGroup;
    ecsClusterOutputName: cdk.CfnOutput;
    ecsClusterOutputArn: cdk.CfnOutput;



    constructor(private readonly stack: cdk.Stack,
        private id: string,
        private videoStorageStack: VideoStorageStack,
        private devopsStack: DevopsStack,
        private bus: IEventBus,
        private props?: cdk.StackProps) {

        /** VPC Definition */
        this.vpc = new ec2.Vpc(stack, "CloudVpc", {
            maxAzs: 2 // Default is all AZs in region
        });

        this.vpc.addGatewayEndpoint('S3GatewayVpcEndpoint', {
            service: ec2.GatewayVpcEndpointAwsService.S3
        });
        this.vpc.addInterfaceEndpoint('EcrDockerVpcEndpoint', {
            service: ec2.InterfaceVpcEndpointAwsService.ECR_DOCKER
        });
        this.vpc.addInterfaceEndpoint('EcrVpcEndpoint', {
            service: ec2.InterfaceVpcEndpointAwsService.ECR
        });
        this.vpc.addInterfaceEndpoint('CloudWatchLogsVpcEndpoint', {
            service: ec2.InterfaceVpcEndpointAwsService.CLOUDWATCH_LOGS
        });

        this.dlqQueueVideoProcessing = this.createStdQueue({
            description: "Queue to handle upload events that have failed to be processed",
            cnfId: "QueueDLQVideoUploadEventTarget",
            name: "QueueDLQVideoUploadEvent"
        });

        this.createEcsClusterFargate(id);
        this.prepareStateMachine()
        this.linkGoldUsersBucketToEventBridge(id);



    }
    createEcsClusterFargate(id: string) {

        //this.videoUploadEventRule.addTarget(new targets.SfnStateMachine(machine: sfn.IStateMachine, props?: SfnStateMachineProps));
        //https://containers-cdk-react-amplify.ws.kabits.com/backend-containers-with-aws-cdk/creating-task/

        this.ecsCluster = new ecs.Cluster(this.stack, "VideoProcessingCluster", {
            vpc: this.vpc,
            enableFargateCapacityProviders: true,
            containerInsights: true
        });
        this.ecsClusterOutputName = new cdk.CfnOutput(this.stack, 'EcsClusterOutputName', {
            value: this.ecsCluster.clusterName,
            description: 'Name of the ECS Cluster'
        });
        this.ecsClusterOutputArn = new cdk.CfnOutput(this.stack, 'EcsClusterOutputArn', {
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

        this.asg = new AutoScalingGroup(this.stack, "ASG", {
            instanceType: new ec2.InstanceType(Constants.instanceType),
            machineImage: ecs.EcsOptimizedImage.amazonLinux2(),
            associatePublicIpAddress: true,
            maxCapacity: Constants.asg_max_capacity,
            desiredCapacity: Constants.asg_desired_capacity,
            minCapacity: Constants.asg_min_capacity,
            vpc: this.vpc,
            vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
            newInstancesProtectedFromScaleIn: false,
            healthCheck: HealthCheck.ec2(),
        })
        const myCapacityProvider = new ecs.AsgCapacityProvider(this.stack, Constants.ASG_PROVIDER, {
            autoScalingGroup: this.asg,
            enableManagedScaling: true,
            enableManagedTerminationProtection: false,
            targetCapacityPercent: Constants.asg_targetCapacityPercent
        });
        this.ecsCluster.addAsgCapacityProvider(myCapacityProvider);
        this.ecsCluster.addDefaultCapacityProviderStrategy([
            { capacityProvider: "DefaultAutoScalingGroupCapacity", base: Constants.default_max_capacity, weight: 0 },
            { capacityProvider: Constants.ASG_PROVIDER, base: Constants.asg_max_capacity, weight: 1 },
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
        this.fargateTaskDefinition = new ecs.FargateTaskDefinition(this.stack, 'ApiTaskDefinition', {
            memoryLimitMiB: Constants.container_memoryLimitMiB,
            cpu: Constants.container_cpu,
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
            image: ecs.ContainerImage.fromRegistry(this.devopsStack.ecsPipeline.ecr_repo.repositoryUri),
            logging: ecs.LogDrivers.awsLogs({ streamPrefix: 'video-api' }),
            environment: {
                INPUT_VIDEO_FILE_URL: "s3://841493508515-upload-bucket/file_example_MP4_1920_18MG.mp4",
                FFMPEG_OPTIONS: "",
                OUTPUT_FILENAME: "/tmp/video.mp4",
                OUTPUT_S3_PATH: this.videoStorageStack.uploadVideoBucket.s3UrlForObject("/generated/video.mp4"),
                AWS_REGION: "us-east-1"
            }
            // ... other options here ...
        });

        this.containerDefinition.addPortMappings({
            containerPort: 3000
        });
    }



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
        this.logGroup = new LogGroup(this.stack, 'VidepUploadLogGroup', {
            logGroupName: `/aws/events/video-upload-events`,
            retention: RetentionDays.ONE_DAY
        });


        const eventPattern = {
            detailType: ["Object Created"],
            source: ["aws.s3"],
            detail: {
                bucket: {
                    name: ["841493508515-upload-bucket"]
                },
                object: {
                    key: [{ "exists": true }],
                    size: [{ "exists": true }]
                }
            }
        };
        // Let's send the events both to step functions and logs.
        this.videoUploadEventRule = new Rule(this.stack, 'VideoUploadS3EventRule', {
            ruleName: `${id}-${this.bus.eventBusName}-videoupload-rule`,
            description: 'Rule matching S3 video upload events',
            eventBus: this.bus,
            eventPattern,
        });

        this.videoUploadEventRule.addTarget(new targets.CloudWatchLogGroup(
            this.logGroup
        ));
        const inputTransformer = {
            _eventId: "VideoUploadEvent",
            bucket: EventField.fromPath("$.detail.bucket.name"),
            video: EventField.fromPath("$.detail.object.key"),
            url: "s3://" + EventField.fromPath("$.detail.bucket.name") + "/" + EventField.fromPath("$.detail.object.key"),
            generatedUrl: "s3://" + EventField.fromPath("$.detail.bucket.name") + "/" + EventField.fromPath("$.detail.object.key") + ".new",
            size: EventField.fromPath("$.detail.object.size")
        };
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
    prepareStateMachine() {
        this.stepFunctionLogGroup = new LogGroup(this.stack, 'StepFunctionLoadGroup', {
            logGroupName: `/aws/events/stepfunction-video`,
            retention: RetentionDays.ONE_DAY
        });

        const runTask = new tasks.EcsRunTask(this.stack, 'InvokeFFMpeg', {
            integrationPattern: sfn.IntegrationPattern.RUN_JOB,
            cluster: this.ecsCluster,
            taskDefinition: this.fargateTaskDefinition,
            assignPublicIp: true,
            containerOverrides: [{
                containerDefinition: this.containerDefinition,
                environment: [
                    { name: 'INPUT_VIDEO_FILE_URL', value: sfn.JsonPath.stringAt('$.url') },
                    { name: 'FFMPEG_OPTIONS', value: "" },
                    { name: 'OUTPUT_FILENAME', value: "/tmp/video.mp4" },
                    { name: 'OUTPUT_S3_PATH', value: sfn.JsonPath.stringAt('$.generatedUrl') },
                    { name: 'AWS_REGION', value: "us-east-1" }

                ],
            }],
            launchTarget: new tasks.EcsFargateLaunchTarget(),
        });

        const definition = runTask.next(new sfn.Succeed(this.stack, "VideoProcessed"));
        //
        this.stateMachine = new sfn.StateMachine(this.stack, 'VideoProcessingStackMachine', {
            definition: definition,
            tracingEnabled: true,
            logs: {
                level: sfn.LogLevel.ALL,
                includeExecutionData: true,
                destination: this.stepFunctionLogGroup

            }
        });
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