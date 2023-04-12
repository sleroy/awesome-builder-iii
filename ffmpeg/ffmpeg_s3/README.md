To use this Docker image, we need to pass the following env variables : 

INPUT_VIDEO_FILE_URL=s3 url
FFMPEG_OPTIONS=ffmpeg options
OUTPUT_FILENAME=temporary output file name
OUTPUT_S3_PATH=
like in s3://${OUTPUT_S3_PATH}
AWS_REGION=
TEMP_FILE=

## Build

docker build --pull --rm -f "Dockerfile" -t sylvainleroy/ffmpeg-s3:latest "."
docker push sylvainleroy/ffmpeg-s3:latest

## Example 1

./example1.sh

dckr_pat_n_uFLYA6wd8FV8dNUtbjtnj5oto