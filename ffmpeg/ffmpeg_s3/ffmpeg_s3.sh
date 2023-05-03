#!/bin/bash
#  aws s3 cp s3://bucket/folder/file.txt .

echo "Transfering data from S3 ${INPUT_VIDEO_FILE_URL}->${TEMP_FILE}"
echo "Output file will be stored into $OUTPUT_BUCKET and $OUTPUT_VIDEO and resolution $RESOLUTION"
baseFile=$(basename $OUTPUT_VIDEO) 
DIR="$(dirname "${OUTPUT_VIDEO}")"
extension="${baseFile##*.}"
filename="${baseFile%.*}"
OUTPUT_S3_PATH="s3://$OUTPUT_BUCKET/$DIR/${filename}_${RESOLUTION}.${extension}"
aws s3 cp ${INPUT_VIDEO_FILE_URL} ${TEMP_FILE}
echo "ffmpeg -i ${TEMP_FILE} ${FFMPEG_OPTIONS} -y ${OUTPUT_FILENAME}"

# ffmpeg -i MyMovie.mkv -vf scale=-1:720 -c:v libx264 -crf 18 -preset veryslow -c:a copy MyMovie_720p.mkv
ffmpeg -i ${TEMP_FILE} ${FFMPEG_OPTIONS} -y ${OUTPUT_FILENAME}

RES=$?
if [ ${RES} -ne 0 ]; then
    echo "Conversion using ffmpeg has crashed with the code ${RES}"
    exit ${RES}
fi
if [ -f ${OUTPUT_FILENAME} ]; then
    echo "Copying ${OUTPUT_FILENAME} to S3 at ${OUTPUT_S3_PATH} ..."
    aws s3 cp ${OUTPUT_FILENAME} ${OUTPUT_S3_PATH} --region ${AWS_REGION}
    exit 0;
else
    echo "File has not been generated"
    exit 1;
fi


