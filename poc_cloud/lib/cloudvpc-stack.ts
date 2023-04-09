import * as cdk from 'aws-cdk-lib';


import { Construct } from 'constructs';


// import * as sqs from 'aws-cdk-lib/aws-sqs';
import { VideoProcessingStack } from './video-processing-stack';
import { VideoStorageStack } from './video-storage-stack';
import { DevopsStack } from './devops-stack';
import { EventBus } from 'aws-cdk-lib/aws-events';

export class CloudVpcStack extends cdk.Stack {
  videoProcessingStack: VideoProcessingStack;
  videoStorageStack: VideoStorageStack;
  devopsStack: DevopsStack;
  bus: EventBus;
  busName: cdk.CfnOutput;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Core components
    // EventBridge
    this.bus = new EventBus(this, 'VideoProcessingBus', {
      eventBusName: `${id}-video-processing-event-bus`
    });
    this.bus.archive('VideoProcessingBusArchive', {
      archiveName: 'VideoProcessingBusArchive',
      description: 'VideoProcessingBus Archive',
      eventPattern: {
        //account: [cdk.Stack.of(this).account],
      },
      retention: cdk.Duration.days(365),
    });

    this.videoStorageStack = new VideoStorageStack(this, id, props);
    this.videoProcessingStack = new VideoProcessingStack(this, id, this.videoStorageStack, this.bus, props);
    this.devopsStack = new DevopsStack(this, id, props);

    // outputs
    this.busName = new cdk.CfnOutput(this, 'EventBusName', {
      value: this.bus.eventBusName,
      description: 'Name of the bus created for video processing events'
    });
  }


}

