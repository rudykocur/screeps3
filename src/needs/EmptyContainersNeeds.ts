import { CreepRole, CREEP_ROLE_GENERIC, CREEP_ROLE_HAULER } from "../constants"
import { DepositEnergy } from "tasks/DepositEnergy"
import { LoadEnergyTask } from "tasks/LoadEnergyTask"
import { RoomManager } from "tasks/RoomManager"
import { ResourceTransferNeed, NeedGenerator, LOWEST_PRIORITY, NeedsProvider, Need } from "./NeedGenerator"
import { Optional } from "types"
import { RoomAnalyst } from "tasks/RoomAnalyst"
import { notEmpty } from "utils/common"

export class EmptyContainerNeedProvider implements NeedsProvider {

    protected roles?: CreepRole[] = undefined

    constructor(
        private generator: NeedGenerator,
        private room: RoomManager,
        protected analyst: RoomAnalyst
    ) {}

    generate(): Need[] {
        const storage = this.analyst.getStorage()

        if(!storage || storage.isFull()) {
            return []
        }

        return this.analyst
            .getMiningSites()
            .map(site => site.container)
            .filter(notEmpty)
            .filter(container => {
                const reserved = Game.reservationManager.getHandler(container)?.getReservedAmount() || 0
                return container.store.getUsedCapacity() - reserved > 100
            })
            .map(container => {
                return new EmptyContainerNeed(
                    this.generator,
                    this.room,
                    {
                        amount: container.store.getUsedCapacity(),
                        container: container,
                        roles: this.roles
                    }
                )
            }) || []
    }

    isActive() {
        return true
    }
}

export class EmptyContainerAtCriticalNeedProvider extends EmptyContainerNeedProvider {
    roles = [CREEP_ROLE_GENERIC]

    isActive() {
        if(!this.analyst) {
            return false
        }

        return this.analyst.isRoomAtCritical()
    }
}

export class EmptyContainerNeed implements ResourceTransferNeed {
    roles: CreepRole[] = [CREEP_ROLE_HAULER]
    infinite = false

    public amount: number
    public container: StructureContainer

    constructor(
        private generator: NeedGenerator,
        private room: RoomManager,
        {amount, container, roles}: {
            amount: number,
            container: StructureContainer,
            roles?: CreepRole[]
        }
        ) {
            this.amount = amount
            this.container = container
            if(roles) {
                this.roles = roles
            }
        }

    generate(actor: Creep) {
        const parentTask = this.generator.scheduleBackgroundTask(DepositEnergy, {
            actor: actor,
            room: this.room,
        })

        this.generator.scheduleChildTask(parentTask, LoadEnergyTask, {
            actor: actor,
            container: this.container
        })
    }

    calculateCost(actor: Creep) {
        const storeLocation = this.room.getRoomAnalyst()?.getStorage()?.location

        if(!storeLocation) {
            return LOWEST_PRIORITY
        }

        return actor.pos.getRangeTo(this.container) + this.container.pos.getRangeTo(storeLocation)
    }

    toString() {
        return `[EmptyContainerNeed site=${this.container}]`
    }
}
