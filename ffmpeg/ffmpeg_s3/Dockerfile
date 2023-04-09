FROM jrottenberg/ffmpeg
LABEL maintainer="Sylvain Leroy <contact+docker@sylvainleroy.com>"

RUN apt-get update && \
    apt-get install python-dev python-pip -y && \
    apt-get clean

RUN pip install awscli

WORKDIR /tmp/workdir

COPY ffmpeg_s3.sh /tmp/workdir
ENV OUTPUT_FILENAME=/tmp/video.mp4
ENV TEMP_FILE=/tmp/raw.mp4
ENTRYPOINT ./ffmpeg_s3.sh
