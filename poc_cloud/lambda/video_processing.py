import os
import boto3
def send_sns(message, subject):
    client = boto3.client("sns")
    topic_arn = os.environ["SNS_ARN"]
    client.publish(
        TopicArn=topic_arn, Message=message, Subject=subject)def lambda_handler(event, context):
    message = "Hello from lambda!"
    subject = "From  Lambda"
    send_sns(message, subject)
    return {'statusCode': 200}