import * as iam from "aws-cdk-lib/aws-iam"
import * as cdk from 'aws-cdk-lib';
import * as ec2 from "aws-cdk-lib/aws-ec2"
import * as ecs from "aws-cdk-lib/aws-ecs"
import { aws_s3 as s3, RemovalPolicy } from 'aws-cdk-lib';

// unprocessedVideosBucket.arnForObjects('*')

export const ipLimitPolicy = function (resources: string) {
    const policy = new iam.PolicyStatement({
        actions: ['s3:Get*', 's3:List*'],
        resources: [resources],
        principals: [new iam.AnyPrincipal()]
    });
    policy.addCondition('IpAddress', {
        "aws:SourceIp": ['1.2.3.4/22']
    });
    return policy;
}


export const s3AllPolicy = function () {
    const policy = new iam.PolicyStatement({
        actions: ['s3:*'],
        resources: [],
        principals: [new iam.AnyPrincipal()]
    });
    return policy;
}

export const removeUnusedVideosLifecyclePolicy = function (days: number) {
    const removeUnusedVideosLifecyclePolicy: s3.LifecycleRule = {
        abortIncompleteMultipartUploadAfter: cdk.Duration.days(days),
        enabled: true,
        expiration: cdk.Duration.days(days),
        expirationDate: new Date(),
        expiredObjectDeleteMarker: false,
        id: 'expire-videos-after-30-days',
    };

    return removeUnusedVideosLifecyclePolicy;
};

/****/