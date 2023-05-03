import * as cdk from 'aws-cdk-lib';


import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';

// import * as sqs from 'aws-cdk-lib/aws-sqs';
import { EventBus, IEventBus } from 'aws-cdk-lib/aws-events';

export class CloudVpcStack extends cdk.Stack {

  bus: IEventBus;
  busName: cdk.CfnOutput;
  vpc: ec2.Vpc;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Core components
    // EventBridge
    this.bus = EventBus.fromEventBusName(this, 'default-bus', 'default');

    // outputs
    this.busName = new cdk.CfnOutput(this, 'EventBusName', {
      value: this.bus.eventBusName,
      description: 'Name of the bus created for video processing events'
    });

      /** VPC Definition */
      this.vpc = new ec2.Vpc(this, "CloudVpc", {
          maxAzs: 3 // Default is all AZs in region
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

  }


}

