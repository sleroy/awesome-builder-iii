FROM jrottenberg/ffmpeg:4.1-alpine
LABEL maintainer="Sylvain Leroy <contact+docker@sylvainleroy.com>"

RUN apt-get update && \
    apt-get install python-dev python3-pip -y && \
    apt-get clean

RUN pip install awscli

WORKDIR /tmp/workdir

COPY ffmpeg_s3.sh /tmp/workdir  
ENV OUTPUT_FILENAME=/tmp/video.mp4
ENV TEMP_FILE=/tmp/raw.mp4
RUN chmod +x ffmpeg_s3.sh
ENTRYPOINT ./ffmpeg_s3.sh
