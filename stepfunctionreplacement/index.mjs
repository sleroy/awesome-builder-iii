import { S3 } from "@aws-sdk/client-s3";
import { SNS, SNSClient, PublishCommand } from "@aws-sdk/client-sns";
import { BatchClient, Batch, SubmitJobCommand, DescribeJobsCommand } from "@aws-sdk/client-batch";

/**
 * Constants
 */
const regionName = "us-east-1";
const globalTopicArn = "arn:aws:sns:us-east-1:841493508515:VideoProcessingStack-NotificationSNS34780774-mCaBrGy1lrYC";
const jobDefinitionParameters = {
    "silver": {
        jobDefinition: "arn:aws:batch:us-east-1:841493508515:job-definition/LowTierJobDefinition:1",
        jobQueue: "arn:aws:batch:us-east-1:841493508515:job-queue/video-processing-lowtier-queue",
        jobName: "InvokeFFMpeg_resolution_Low_",
    },
    "gold": {
        jobDefinition: "arn:aws:batch:us-east-1:841493508515:job-definition/HighTierJobDefinition:1",
        jobQueue: "arn:aws:batch:us-east-1:841493508515:job-queue/video-processing-hightier-queue",
        jobName: "InvokeFFMpeg_resolution_High_",
    }
}



/** Initialize the SNS Client */
const sns = new SNSClient({ region: regionName });
const batch = new BatchClient({ region: regionName });

/** FOR DEBUGGING ONLY */
const event = {
    "_eventId": "VideoUploadEvent",
    "bucket": "841493508515-customer-storage-hightier",
    "video": "private/us-east-1:c1a0f1f1-c0f4-417a-b080-a3c5ca4a0bdb/file_example_MP4_1920_18MG.mp4",
    "url": "s3://841493508515-customer-storage-hightier/private/us-east-1:c1a0f1f1-c0f4-417a-b080-a3c5ca4a0bdb/file_example_MP4_1920_18MG.mp4",
    "size": 17839845,
    "customer": "X16BKX2N5XHPM1FZ",
    "customerTier": "gold"
};

doEvent(event)


/** FUNCTIONS */
function isGoldCustomer(event) { return event.customerTier === 'gold' };
function delay(time) {
    return new Promise(resolve => setTimeout(resolve, time));
  } 

async function sendNotification(subject, message) {
    const input = { // PublishInput
        TopicArn: globalTopicArn,
        Message: message,
        Subject: subject,
    };
    const command = new PublishCommand(input)
    return await sns.send(command);
}

async function renderVideoResolution(event, resolution) {

    const jobParams = isGoldCustomer(event) ? jobDefinitionParameters['gold'] : jobDefinitionParameters['silver']
    console.info(`Launching video processing for the resolution ${resolution} in queue ${jobParams.jobQueue}`)
    const jobRequest = { // SubmitJobRequest
        jobName: jobParams.jobName + resolution,
        jobQueue: jobParams.jobQueue,
        jobDefinition: jobParams.jobDefinition,
        parameters: { // ParametersMap
        },
        containerOverrides: { // ContainerOverrides
            environment: [ // EnvironmentVariables
                {
                    "Name": "INPUT_VIDEO_FILE_URL",
                    "Value": event.url
                },
                {
                    "Name": "FFMPEG_OPTIONS",
                    "Value": " -vf scale=-2:160 -crf 18 -preset slow -c:a copy "
                },
                {
                    "Name": "OUTPUT_FILENAME",
                    "Value": "/tmp/video160.mp4"
                },
                {
                    "Name": "OUTPUT_BUCKET",
                    "Value": "841493508515-video-distribution"
                },
                {
                    "Name": "OUTPUT_VIDEO",
                    "Value": event.video
                },
                {
                    "Name": "RESOLUTION",
                    "Value": resolution
                },
                {
                    "Name": "AWS_REGION",
                    "Value": regionName
                },
                {
                    "Name": "ECS_ENABLE_AWSLOGS_EXECUTIONROLE_OVERRIDE",
                    "Value": "true"
                }
            ],
            resourceRequirements: [ // ResourceRequirements
                {
                    type: "MEMORY",
                    value: "1024"
                },
                {
                    type: "VCPU",
                    value: "0.5"
                }
            ],
        },
        retryStrategy: { // RetryStrategy
            attempts: 1
        },
        propagateTags: true,
        /**   timeout: { // JobTimeout
               attemptDurationSeconds: Number("int"),
           },
            */
        tags: { // TagrisTagsMap
            customerTier: event.customerTier,
            customer: event.customer
        }
    };
    const command = new SubmitJobCommand(jobRequest);
    const response = await batch.send(command);
    console.log("Response submission job", JSON.stringify(response))

    /**
    let isRunning = true;
    while (isRunning) {
        const getStatusRequest = { // DescribeJobsRequest
            jobs: [response.jobId],
        };
        const getStatusResponse = await batch.send(new DescribeJobsCommand(getStatusRequest));
        //console.log("getStatusResponse : ", getStatusResponse)
        isRunning = getStatusResponse.jobs.length > 0 && !['FAILED', 'SUCCEEDED'].includes(getStatusResponse.jobs[0].status);
        console.log(`Job status is ${getStatusResponse.jobs[0].status}`)
        await delay(2000);
    }
     */
    return response;
}



/** HANDLER */
async function doEvent(event) {
    console.info("-------------------------------------------------------------")
    console.info("Received S3 Events :", JSON.stringify(event))
    console.info(`Customer is a ${isGoldCustomer(event) ? 'GOLD' : 'SILVER'}`)

    // https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/index.html

    try {
        // Notify the treatement will begin
        await sendNotification("Watchflix : customer " + event.customer + " - video processing", "Videos are going to be processed for " + event.video)

        if ('gold' === event.customerTier) {
            await renderVideoResolution(event, 160)
            await renderVideoResolution(event, 320)
            await renderVideoResolution(event, 480)
            await renderVideoResolution(event, 720)
            await renderVideoResolution(event, 1080)
        } else {
            await renderVideoResolution(event, 160)
            await renderVideoResolution(event, 320)
        }
        // Notify the treatement will begin
        await sendNotification("Watchflix : customer " + event.customer + " - video processing", "Video have been processed for " + event.video)

    } catch (error) {
        await sendNotification("Watchflix : customer " + event.customer + " - video has failed", "Video " + event.video + ` could not be processed for the reason ${error}`)
        throw new Error("Processing video has failed " + error);
    } finally {
        // finally.
        console.info("-------------------------------------------------------------")
    }

}