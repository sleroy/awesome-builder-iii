import * as cdk from 'aws-cdk-lib';
import * as ec2 from "aws-cdk-lib/aws-ec2"
import * as ecr from "aws-cdk-lib/aws-ecr"
import * as sqs from "aws-cdk-lib/aws-sqs"
import * as sns from "aws-cdk-lib/aws-sns"
import * as s3n from "aws-cdk-lib/aws-s3-notifications"
import * as ecs from "aws-cdk-lib/aws-ecs"
import * as iam from "aws-cdk-lib/aws-iam"
import * as subs from 'aws-cdk-lib/aws-sns-subscriptions';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as codebuild from "aws-cdk-lib/aws-codebuild";
import * as codepipeline from "aws-cdk-lib/aws-codepipeline";
import * as codepipeline_actions from "aws-cdk-lib/aws-codepipeline-actions";
import * as cloudformation from "aws-cdk-lib/aws-cloudformation";
import * as codecommit from "aws-cdk-lib/aws-codecommit";

import { aws_s3 as s3, RemovalPolicy } from 'aws-cdk-lib';

import { Construct } from 'constructs';
import { BlockPublicAccess, BucketEncryption, StorageClass, Bucket, BucketNotificationDestinationConfig } from 'aws-cdk-lib/aws-s3';
import { ArnPrincipal } from 'aws-cdk-lib/aws-iam';
import { removeUnusedVideosLifecyclePolicy, s3AllPolicy } from './iam/policies';
import { createBuckets, createRegularBucket } from './buckets';
import { defineRoles } from './iam';

interface EcrPipeline {
    ecr_repo: cdk.aws_ecr.Repository;
    code_repo: cdk.aws_codecommit.Repository;
    pipeline: codepipeline.Pipeline;
}

export class DevopsStack {
    ecsPipeline: EcrPipeline;


    constructor(private readonly stack: cdk.Stack, private id: string, private props?: cdk.StackProps) {
        // buildEcrPipeline("lambda", stack);
        this.ecsPipeline = buildEcrPipeline("ecs", stack);
    }

    /**
     * I want to add a custom CF resource that commits example files to the CodeCommit repo. 
     * Maybe will finish this at a later time?
     */
    /*
    const fn = new lambda.Function(this, 'initializeCodeRepoFunction', {
      code: lambda.Code.fromAsset(path.join(__dirname, 'lambda/initialize-code-repo')),
      handler: 'index.handler',
      runtime: lambda.Runtime.NODEJS_10_X,
      environment: {
        'REPO_NAME': code_repo.repositoryName,
        'REPO_ARN': code_repo.repositoryArn,
      }
    });
    // Give Lambda permission to interact with CodeCommit
    fn.addToRolePolicy(new iam.PolicyStatement({
      resources: [code_repo.repositoryArn],
      actions: ['codecommit:*'],         // This could be further scoped down...
      effect: iam.Effect.ALLOW
    }));
  
    const initializeCodeCommitResource = new cloudformation.CustomResource(this, 'InitializeCodeCommitResource', {
      provider: cloudformation.CustomResourceProvider.lambda(fn)
    });
    */

}

function buildEcrPipeline(purpose: string, stack: cdk.Stack): EcrPipeline {

    // The ECR repository we will get built by our Code Pipeline
    const ecr_repo = new ecr.Repository(stack, `ecr${purpose}ImageRepository`);

    // CodeCommit repository that contains the Dockerfile used to build our ECR image: 
    const code_repo = new codecommit.Repository(stack, `code${purpose}ImageRepository`, {
        repositoryName: `${purpose}-dockerfile-repo`
    });
    new cdk.CfnOutput(stack, `CodeCommit${purpose}RepositoryUrl`, { value: code_repo.repositoryCloneUrlHttp });

    // Pipeline that triggers on pushes to CodeCommit repo to build our ECR image: 
    const pipeline = new codepipeline.Pipeline(stack, `${purpose}EcrPipeline`, {
        pipelineName: `${purpose}EcrPipeline`
    });

    // Configure our pipeline to pull in our Code Commit repo as the pipeline source: 
    const sourceOutput = new codepipeline.Artifact();
    const sourceAction = new codepipeline_actions.CodeCommitSourceAction({
        actionName: 'CodeCommit',
        repository: code_repo,
        output: sourceOutput,
        branch: 'main'        
    });

    pipeline.addStage({
        stageName: 'Source',
        actions: [sourceAction]        
    });

    /**
     * Create a CodeBuild project to build a Dockerfile into an image and push it to ECR.
     * 
     * Note - In order for the project to actually do this, the source code pushed
     * to the CodeCommit repo needs to have a properly defined buildspec.yml and
     * Dockerfile. At this time, example files are in my GitHub project, but you
     * will have to push them to CodeCommit. Later, I may look at somehow initializing
     * CodeCommit with an initial example file via custom resources.
     */
    const project = new codebuild.PipelineProject(stack, `${purpose}DockerImageProject`, {
        environmentVariables: {
            // It is expected that our buildspec.yml in our source code will reference
            // this environment variable to determine which ECR repo to push the built image. 
            ECR_REPOSITORY_URI: {
                type: codebuild.BuildEnvironmentVariableType.PLAINTEXT,
                value: ecr_repo.repositoryUri
            },
            IMAGE_TAG: { type: codebuild.BuildEnvironmentVariableType.PLAINTEXT, value: 'latest' },
            IMAGE_REPO_URI: {type: codebuild.BuildEnvironmentVariableType.PLAINTEXT, value: ecr_repo.repositoryUri },
            AWS_DEFAULT_REGION: { type: codebuild.BuildEnvironmentVariableType.PLAINTEXT, value: process.env.CDK_DEFAULT_REGION },
        },
        // privileged = true is needed in order to run docker build:
        environment: {
            privileged: true
        }
    });

    project.addToRolePolicy(new iam.PolicyStatement({
        resources: ['*'], // This could be further scoped down, but to limit on an ECR blocks the login ecr_repo.repositoryArn
        actions: ['ecr:*'],         // This could be further scoped down...
        effect: iam.Effect.ALLOW
    }));

    // Add our CodeBuild project to our CodePipeline
    const buildAction = new codepipeline_actions.CodeBuildAction({
        actionName: 'CodeBuild',
        project,
        input: sourceOutput
    });
    pipeline.addStage({
        stageName: 'Build',
        actions: [buildAction]
    });
    return {
        code_repo,
        ecr_repo,
        pipeline
    };
}
