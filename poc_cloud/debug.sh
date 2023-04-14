aws ecs describe-tasks --cluster container-demo \
                       --tasks \
                         $(aws ecs list-tasks --cluster container-demo --query 'taskArns[]' --output text) \
                       --query 'sort_by(tasks,&capacityProviderName)[].{ 
                                          Id: taskArn, 
                                          AZ: availabilityZone, 
                                          CapacityProvider: capacityProviderName, 
                                          LastStatus: lastStatus, 
                                          DesiredStatus: desiredStatus}' \
                        --output table