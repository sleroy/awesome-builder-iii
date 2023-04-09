export default interface QueueDefinition {
    cnfId: string,
    name: string,
    description: string,
    maxReceiveCount?: number
}

