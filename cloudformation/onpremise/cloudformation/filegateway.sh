#!/bin/bash
# Arguments are <region 
REGION=$1
stackName=$2
if [ "$#" -ne 2 ]; then
    echo "Illegal number of parameters"
    exit 1;
fi

echo "Region is $REGION"
echo "Stack name is $stackName"

echo clear log > /var/log/cloud-init-output.log
yum install -y pip nc
pip install --upgrade awscli &> /tmp/pip
/usr/bin/aws configure set default.region $REGION

instance=$(curl http://169.254.169.254/latest/meta-data/instance-id)
ip=$(curl http://169.254.169.254/latest/meta-data/local-ipv4)
echo $ip
name=Hybrid-Workshop-File-Gateway-Server-1-${instance}
gwMode=FILE_S3
region=$REGION
complete=0
count=1
while [ $complete != 2 -a $count != 30 ]; do
if [ $count -ne 1 ]; then
sleep 15
fi
if [ $complete -eq 0 ]; then
    code=$(echo -e "GET ?gatewayType=${gwMode}&activationRegion=${region} HTTP/1.1\n\n" | nc localhost 8080 | grep -oP 'activationKey=([\w-]+)' | cut -f2 -d=)
    if [[ $code != "" ]]; then
        gatewayarn=$(/usr/bin/aws storagegateway activate-gateway --activation-key ${code} --gateway-name ${name} --gateway-timezone GMT --gateway-type ${gwMode} --gateway-region ${region} --region ${region} --output text)
        if [ $? -eq 0 ]; then complete=1; echo ${gatewayarn}; fi
    fi
fi
if [ $complete -eq 1 ]; then
    disks=$(/usr/bin/aws storagegateway list-local-disks --gateway-arn ${gatewayarn} --region ${region} --output text)
    disks=$(echo "$disks"| awk '{print $4}')
    diskarray=($disks)
    /usr/bin/aws storagegateway add-cache --gateway-arn ${gatewayarn} --disk-ids --region ${region} ${diskarray[0]}
    if [ $? -eq 0 ]; then complete=2; fi
fi
count=$((count+1))
done
if [ $complete -eq 2 ]; then
    usr/local/bin/aws ec2 create-tags --resources ${instance} --tags "Key=Name,Value='Hybrid Workshop - Migrate - Gateway Server 1 (Activated) - ($stackName)"
else
    /usr/bin/aws ec2 create-tags --resources ${instance} --tags "Key=Name,Value='Hybrid Workshop - Migrate - Gateway Server 1 (FAILED ACTIVATION) - $stackName"
fi
echo finished
cat /var/log/cloud-init-output.log >> /tmp/message
