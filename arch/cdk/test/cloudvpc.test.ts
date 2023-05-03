import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import * as CloudVpc from '../lib/cloudvpc-stack';

import { CloudVpcStack } from '../lib/cloudvpc-stack';

// example test. To run these tests, uncomment this file along with the
// example resource in lib/git-stack.ts
test('SQS Queue Created', () => {
//   const app = new cdk.App();
//     // WHEN
//   const stack = new Git.GitStack(app, 'MyTestStack');
//     // THEN
//   const template = Template.fromStack(stack);

//   template.hasResourceProperties('AWS::SQS::Queue', {
//     VisibilityTimeout: 300
//   });
});
test('S3 Bucket created', () => {
    const app = new cdk.App();
    //     // WHEN
    const stack = new CloudVpc.CloudVpcStack(app, 'MyTestStack');
    //     // THEN
    const template = Template.fromStack(stack);
    
    template.hasResourceProperties('AWS::S3::Bucket', {
        BucketName: `${app.account}-unprocessedvideo-bucket`
    });
});
    