import * as cdk from 'aws-cdk-lib';
import * as ecr from "aws-cdk-lib/aws-ecr"
import * as iam from "aws-cdk-lib/aws-iam"
import * as codebuild from "aws-cdk-lib/aws-codebuild";
import * as codepipeline from "aws-cdk-lib/aws-codepipeline";
import * as codepipeline_actions from "aws-cdk-lib/aws-codepipeline-actions";
import * as codecommit from "aws-cdk-lib/aws-codecommit";
import { Construct } from 'constructs';
import { App, CfnOutput, NestedStack, NestedStackProps, Stack } from 'aws-cdk-lib/core';



interface EcrPipeline {
    ecr_repo: cdk.aws_ecr.Repository;
    code_repo: cdk.aws_codecommit.Repository;
    pipeline: codepipeline.Pipeline;
}

export class DevopsStack extends cdk.Stack {
    ecsPipeline: EcrPipeline;
   


    constructor(scope: Construct, id: string, props?: cdk.StackProps) {
        super(scope, id, props);

        // buildEcrPipeline("lambda", stack);
        this.ecsPipeline = this.buildEcrPipeline("ecs", this);
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


    buildEcrPipeline(purpose: string, stack: cdk.Stack): EcrPipeline {

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
            IMAGE_REPO_URI: { type: codebuild.BuildEnvironmentVariableType.PLAINTEXT, value: ecr_repo.repositoryUri },
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

}