
# awesome-builder-iii

Install cfpack.js to build the cloudformation template.

[CfPack tool](https://www.npmjs.com/package/cfpack.js)


Project for Amazon Awesome Builder III

* The project is configured for us-west-1
* Deploy the On-premise environment
* Enable System Manager quick setup
 * Enable Host Management (create)


How to build the docker image for ECS and Lambda.

- create two docker files
 * Dockerfile-lambda : provides a docker file that handles ffmpeg and Node.JS for Lambda
 * Dockerfile-ecs : provides a docker file that handles ffmpeg and Node.JS for ECS
- Prepare a pipeline following the help here : https://docs.aws.amazon.com/codebuild/latest/userguide/setting-up.html#setting-up-service-role
  - automation using CDK