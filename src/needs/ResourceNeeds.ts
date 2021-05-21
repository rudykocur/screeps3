import { CreepRole, CREEP_ROLE_GENERIC, CREEP_ROLE_HAULER } from "../constants"
import { DepositEnergy } from "tasks/DepositEnergy"
import { PickupResourceTask } from "tasks/PickupResource"
import { RoomAnalyst } from "tasks/RoomAnalyst"
import { IRoomManager, IScheduler } from "interfaces"
import { NeedsProvider, Need, ResourceTransferNeed, LOWEST_PRIORITY, NeedPriority } from "./interfaces"

export class ResourcePickupProvider implements NeedsProvider {
    protected roles?: CreepRole[]

    constructor(
        private scheduler: IScheduler,
        private room: IRoomManager,
        protected analyst: RoomAnalyst,
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
                    this.scheduler,
                    this.room,
                    {
                        amount: resource.amount,
                        resource: resource,
                        roles: this.roles
                    }
                )
            })
    }

    isActive() {
        return true
    }
}

export class ResourcePickupAtCriticalProvider extends ResourcePickupProvider {
    roles = [CREEP_ROLE_GENERIC]

    isActive() {
        return this.analyst.isRoomAtCritical()
    }
}

export class ResourcePickupNeed implements ResourceTransferNeed {
    roles: CreepRole[] = [CREEP_ROLE_HAULER]
    infinite = false
    priority = NeedPriority.NORMAL

    public amount: number
    public resource: Resource

    public weight: number = 0.8

    constructor(
        private scheduler: IScheduler,
        private room: IRoomManager,
        {amount, resource, roles}: {
            amount: number,
            resource: Resource,
            roles?: CreepRole[]
        }) {
            this.amount = amount
            this.resource = resource

            if(roles) {
                this.roles = roles
            }
        }

    generate(actor: Creep) {
        const parentTask = this.scheduler.scheduleBackgroundTask(DepositEnergy, {
            actor: actor,
            room: this.room,
        })

        this.scheduler.scheduleChildTask(parentTask, PickupResourceTask, {
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
