import { CreepRole, CREEP_ROLE_GENERIC, CREEP_ROLE_HAULER } from "../constants"
import { DepositEnergy } from "tasks/DepositEnergy"
import { LoadEnergyTask } from "tasks/LoadEnergyTask"
import { RoomAnalyst } from "tasks/RoomAnalyst"
import { notEmpty } from "utils/common"
import { IRoomManager, IScheduler } from "interfaces"
import { NeedsProvider, Need, LOWEST_PRIORITY, NeedPriority } from "./interfaces"
import { WithdrawableStructureWithGeneralStorage } from "types"

export class EmptyContainerNeedProvider implements NeedsProvider {

    protected roles?: CreepRole[] = undefined

    constructor(
        private scheduler: IScheduler,
        private room: IRoomManager,
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
                const averageCarry = this.analyst.getHaulerCarryCapacity()
                const minimumAmount = Math.min(container.store.getCapacity()/2, averageCarry*0.66)
                return container.store.getUsedCapacity() - reserved > minimumAmount
            })
            .map(container => {
                return new EmptyContainerNeed(
                    this.scheduler,
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

export class EmptyTombstoneNeedProvider implements NeedsProvider {

    protected roles?: CreepRole[] = undefined

    constructor(
        private scheduler: IScheduler,
        private room: IRoomManager,
        protected analyst: RoomAnalyst
    ) {}

    generate(): Need[] {
        const storage = this.analyst.getStorage()

        if(!storage || storage.isFull()) {
            return []
        }

        return this.analyst
            .getTombstones()
            .filter(tombstone => {
                const reserved = Game.reservationManager.getHandler(tombstone)?.getReservedAmount() || 0
                return tombstone.store.getUsedCapacity() - reserved > 100
            })
            .map(tombstone => {
                return new EmptyContainerNeed(
                    this.scheduler,
                    this.room,
                    {
                        amount: tombstone.store.getUsedCapacity(),
                        container: tombstone,
                        roles: this.roles
                    }
                )
            }) || []
    }

    isActive() {
        return true
    }
}

export class EmptyRuinNeedProvider implements NeedsProvider {

    protected roles?: CreepRole[] = undefined

    constructor(
        private scheduler: IScheduler,
        private room: IRoomManager,
        protected analyst: RoomAnalyst
    ) {}

    generate(): Need[] {
        const storage = this.analyst.getStorage()

        if(!storage || storage.isFull()) {
            return []
        }

        return this.analyst
            .getRuins()
            .filter(ruin => {
                const reserved = Game.reservationManager.getHandler(ruin)?.getReservedAmount() || 0
                return ruin.store.getUsedCapacity() - reserved > 100
            })
            .map(ruin => {
                return new EmptyContainerNeed(
                    this.scheduler,
                    this.room,
                    {
                        amount: ruin.store.getUsedCapacity(),
                        container: ruin,
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

export class EmptyContainerNeed implements Need {
    roles: CreepRole[] = [CREEP_ROLE_HAULER]
    infinite = false
    priority = NeedPriority.NORMAL

    public amount: number
    public container: WithdrawableStructureWithGeneralStorage

    constructor(
        private scheduler: IScheduler,
        private room: IRoomManager,
        {amount, container, roles, priority}: {
            amount: number,
            container: WithdrawableStructureWithGeneralStorage,
            roles?: CreepRole[],
            priority?: NeedPriority
        }
        ) {
            this.amount = amount
            this.container = container
            if(roles) {
                this.roles = roles
            }
            if(priority) {
                this.priority = priority
            }
        }

    generate(actor: Creep) {
        const parentTask = this.scheduler.scheduleBackgroundTask(DepositEnergy, {
            actor: actor,
            room: this.room,
        })

        this.scheduler.scheduleChildTask(parentTask, LoadEnergyTask, {
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
