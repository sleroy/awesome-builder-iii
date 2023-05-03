import * as cdk from 'aws-cdk-lib';
import * as ec2 from "aws-cdk-lib/aws-ec2"
import * as ecs from "aws-cdk-lib/aws-ecs"
import * as iam from "aws-cdk-lib/aws-iam"

import { aws_s3 as s3, RemovalPolicy } from 'aws-cdk-lib';
import { BlockPublicAccess, BucketEncryption } from 'aws-cdk-lib/aws-s3';
import { removeInvalidUploadPolicy, removeUnusedVideosLifecyclePolicy, s3AllPolicy } from './policies';

/**
    const storageClass: s3.StorageClass = StorageClass.INFREQUENT_ACCESS;
    const tagFilters: s3.Transition = {
      storageClass: storageClass,

      // the properties below are optional
      transitionAfter: cdk.Duration.days(30),
      transitionDate: new Date(),
    };
*/

export function defineRoles(stack: cdk.Stack, id: string) {

}