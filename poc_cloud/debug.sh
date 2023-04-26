CONTAINER_NAME=CloudVpcStack-VideoProcessingClusterE2F64E8F-9kKwaHfn3mLo

aws ecs describe-tasks --cluster $CONTAINER_NAME \
                       --tasks \
                         $(aws ecs list-tasks --cluster $CONTAINER_NAME --query 'taskArns[]' --output text) \
                       --query 'sort_by(tasks,&capacityProviderName)[].{ 
                                          Id: taskArn, 
                                          AZ: availabilityZone, 
                                          CapacityProvider: capacityProviderName, 
                                          LastStatus: lastStatus, 
                                          DesiredStatus: desiredStatus}' \
                        --output table