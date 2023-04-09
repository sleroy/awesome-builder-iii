#!/bin/sh
docker run -e INPUT_VIDEO_FILE_URL=https://file-examples.com/wp-content/uploads/2017/04/file_example_MP4_480_1_5MG.mp4 \
-e FFMPEG_OPTIONS= \
-e OUTPUT_FILENAME=/tmp/video.mp4 \
-e OUTPUT_S3_PATH=video.mp4 \
-e AWS_REGION=us-east-1 \
--rm -it  ffmpegs3:latest 