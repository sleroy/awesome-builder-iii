import { NestedStackProps } from "aws-cdk-lib";

export interface ResourceNestedStackProps extends NestedStackProps {    
  
    readonly id: string;
}