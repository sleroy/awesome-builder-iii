import { Duration } from "aws-cdk-lib";

export const instanceType = "t3.small";

export const default_max_capacity = 1;
export const default_desired_capacity = 0;
export const default_min_capacity = 0;
export const default_targetCapacityPercent = 100;


export const asg_max_capacity = 1;
export const asg_desired_capacity = 0;
export const asg_min_capacity = 0;
export const asg_targetCapacityPercent = 100;

export const container_memoryLimitMiB = 2048;
export const container_cpu = 1024;
export const container_ephemeralStorageGiB = 25;

export const cooldown = Duration.minutes(5);
export const ASG_PROVIDER = "VideoProcessorCapacityProvider";

// Compute environment
export const minvCpus = 0;
export const desiredvCpus = 0;
export const maxvCpus = 4;
export const maxvCpusfargateSpot = 10;