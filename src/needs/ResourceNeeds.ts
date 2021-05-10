import { CreepRole, CREEP_ROLE_HAULER } from "../constants"
import { DepositEnergy } from "tasks/DepositEnergy"
import { PickupResourceTask } from "tasks/PickupResource"
import { RoomManager } from "tasks/RoomManager"
import { ResourceTransferNeed, NeedGenerator, LOWEST_PRIORITY, NeedsProvider, Need } from "./NeedGenerator"

export class ResourcePickupProvider implements NeedsProvider {
    constructor(
        private generator: NeedGenerator,
        private room: RoomManager
    ) {}

    generate(): Need[] {
        return this.room.getDroppedResources().map(resource => {
            return new ResourcePickupNeed(
                this.generator,
                this.room,
                 {
                     amount: resource.amount,
                     resource: resource
                 }
            )
        })
    }
}

export class ResourcePickupNeed implements ResourceTransferNeed {
    roles: CreepRole[] = [CREEP_ROLE_HAULER]
    infinite = false

    public amount: number
    public resource: Resource

    constructor(
        private generator: NeedGenerator,
        private room: RoomManager,
        {amount, resource}: {
            amount: number,
            resource: Resource
        }) {
            this.amount = amount
            this.resource = resource
        }

    generate(actor: Creep) {
        const parentTask = this.generator.scheduleBackgroundTask(DepositEnergy, {
            actor: actor,
            room: this.room,
        })

        this.generator.scheduleChildTask(parentTask, PickupResourceTask, {
            actor: actor,
            resource: this.resource
        })
    }

    calculateCost(actor: Creep) {
        const storeLocation = this.room.getRoomAnalyst()?.getStorage()?.location

        if(!storeLocation) {
            return LOWEST_PRIORITY
        }

        return actor.pos.getRangeTo(this.resource) + this.resource.pos.getRangeTo(storeLocation)
    }
}
