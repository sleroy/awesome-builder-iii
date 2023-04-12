#!/bin/bash
#  aws s3 cp s3://bucket/folder/file.txt .

echo "Transfering data from S3 ${INPUT_VIDEO_FILE_URL}->${TEMP_FILE}"
aws s3 cp ${INPUT_VIDEO_FILE_URL} ${TEMP_FILE}
echo "ffmpeg -i ${TEMP_FILE} ${FFMPEG_OPTIONS} -y ${OUTPUT_FILENAME}"
ffmpeg -i ${TEMP_FILE} ${FFMPEG_OPTIONS} -y ${OUTPUT_FILENAME}

RES=$?
if [ ${RES} -ne 0 ]; then
    echo "Conversion using ffmpeg has crashed with the code ${RES}"
    exit ${RES}
fi
if [ -f ${OUTPUT_FILENAME} ]; then
    echo "Copying ${OUTPUT_FILENAME} to S3 at ${OUTPUT_S3_PATH} ..."
    aws s3 cp ./${OUTPUT_FILENAME} s3://${OUTPUT_S3_PATH} --region ${AWS_REGION}
    exit 0;
else
    echo "File has not been generated"
    exit 1;
fi


