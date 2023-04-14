#!/bin/bash
rm *.mp4
VIDEO="/tmp/video.mp4"
if [ -f $VIDEO ]; then
    echo "File \"$VIDEO\" exists"
else
#https://samplelib.com/sample-mp4.html
#https://jsoncompare.org/LearningContainer/SampleFiles/Video/MP4/Sample-Video-File-For-Testing.mp4
    wget https://download.samplelib.com/mp4/sample-5s.mp4 -O $VIDEO
    #wget https://file-examples.com/wp-content/uploads/2017/04/file_example_MP4_480_1_5MG.mp4 -O $VIDEO
fi
for i in {1..10}; do 
    aws s3 cp $VIDEO "s3://841493508515-upload-bucket/customer-abc/$i.mp4" &
done