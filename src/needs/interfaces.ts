import { IScheduler } from "interfaces";
import { CreepRole } from "../constants";

export const LOWEST_PRIORITY = 99999999

export enum NeedPriority {
    LAST = 0,
    LOW = 10,
    NORMAL = 20,
    HIGH = 30,
    CRITICAL = 40,
}

export interface Need {
    priority: NeedPriority
    roles: CreepRole[]
    remote?: boolean
    infinite: boolean

    generate(actor: Creep): void
    calculateCost(actor: Creep): number
}

export interface NeedsProvider {
    generate(): Need[]
    isActive(): boolean
}

export interface ResourceTransferNeed extends Need {
    amount: number
    resource?: Resource
    container?: StructureContainer
    tombstone?: Tombstone
}

export interface INeedGenerator extends IScheduler {
    generateNeeds(): Need[]
}
