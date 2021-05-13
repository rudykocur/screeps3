import { CreepRole, CREEP_ROLE_HAULER } from "../constants"
import { DepositEnergy } from "tasks/DepositEnergy"
import { PickupResourceTask } from "tasks/PickupResource"
import { RoomManager } from "tasks/RoomManager"
import { ResourceTransferNeed, NeedGenerator, LOWEST_PRIORITY, NeedsProvider, Need } from "./NeedGenerator"
import { RoomAnalyst } from "tasks/RoomAnalyst"

export class ResourcePickupProvider implements NeedsProvider {
    constructor(
        private generator: NeedGenerator,
        private room: RoomManager,
        private analyst: RoomAnalyst,
    ) {}

    generate(): Need[] {
        const storage = this.analyst.getStorage()

        if(!storage || storage.isFull()) {
            return []
        }

        return this.room.getDroppedResources()
            .filter(resource => {
                const reserved = Game.reservationManager.getHandler(resource)?.getReservedAmount() || 0
                return resource.amount - reserved > 100
            })
            .map(resource => {
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

    isActive() {
        return true
    }
}

export class ResourcePickupNeed implements ResourceTransferNeed {
    roles: CreepRole[] = [CREEP_ROLE_HAULER]
    infinite = false

    public amount: number
    public resource: Resource

    public weight: number = 0.8

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

        return (actor.pos.getRangeTo(this.resource) + this.resource.pos.getRangeTo(storeLocation)) * this.weight
    }

    toString() {
        return `[ResourcePickupNeed resource=${this.resource}]`
    }
}
