import { CreepRole, CREEP_ROLE_BUILDER, CREEP_ROLE_GENERIC, CREEP_ROLE_HAULER } from "../constants"
import { UpgradeControllerTask } from "tasks/UpgradeControllerTask"
import { WithdrawEnergy } from "tasks/WithdrawEnergy"
import { RoomAnalyst } from "tasks/RoomAnalyst"
import { HarvestAndLoadTask } from "tasks/HarvestAndLoadTask"
import { DepositEnergy } from "tasks/DepositEnergy"
import { IRoomManager, IScheduler } from "interfaces"
import { NeedsProvider, Need, LOWEST_PRIORITY, NeedPriority } from "./interfaces"
import { WaitTask } from "tasks/WaitTask"
import { MoveTask } from "tasks/MoveTask"

export class GenericNeedsProvider implements NeedsProvider {

    constructor(
        private scheduler: IScheduler,
        private room: IRoomManager,
        private analyst: RoomAnalyst,
    ) {}

    generate(): Need[] {
        const storedEnergy = this.analyst.getStorage()?.getResourceAmount(RESOURCE_ENERGY)

        if(!storedEnergy || storedEnergy < 1000) {
            return []
        }

        return [
            new UpgradeControllerNeed(this.scheduler, this.room)
        ]
    }

    isActive() {
        return !this.analyst.isRoomAtCritical()
    }
}

export class HarvestEnergyAtCriticalNeedsProvider implements NeedsProvider {

    constructor(
        private scheduler: IScheduler,
        private room: IRoomManager,
        private analyst: RoomAnalyst,
    ) {}

    generate(): Need[] {
        return this.analyst.getSafeSources().map(source => {
            return new HarvestEnergyNeed(this.scheduler, this.room, {
                source: source
            })
        })
    }

    isActive() {
        return this.analyst.isRoomAtCritical()
    }
}

export class HarvestEnergyNeed implements Need {
    roles: CreepRole[] = [CREEP_ROLE_GENERIC]
    infinite = false
    priority = NeedPriority.LOW

    private source: Source

    constructor(
        private scheduler: IScheduler,
        private room: IRoomManager,
        {source}: {
            source: Source
        }) {
            this.source = source
        }

    generate(actor: Creep) {
        const parent = this.scheduler.scheduleBackgroundTask(DepositEnergy, {
            actor: actor,
            room: this.room,
        })

        this.scheduler.scheduleChildTask(parent, HarvestAndLoadTask, {
            actor: actor,
            source: this.source,

        })
    }

    calculateCost(actor: Creep) {
        return actor.pos.getRangeTo(this.source) * 3
    }

    toString() {
        return `[HarvestEnergyNeed source=${this.source}]`
    }
}

export class UpgradeControllerNeed implements Need {
    roles: CreepRole[] = [CREEP_ROLE_GENERIC]
    infinite = true
    priority = NeedPriority.LOW

    constructor(
        private scheduler: IScheduler,
        private room: IRoomManager
    ) {}

    generate(actor: Creep) {
        const parent = this.scheduler.scheduleBackgroundTask(UpgradeControllerTask, {
            actor: actor,
            room: this.room
        })

        this.scheduler.scheduleChildTask(parent, WithdrawEnergy, {
            actor: actor,
            room: this.room
        })
    }

    calculateCost(actor: Creep) {
        return LOWEST_PRIORITY
    }

    toString() {
        return `[UpgradeControllerNeed room=${this.room.label}]`
    }
}

export class RestAtSafeZoneNeedGenerator implements NeedsProvider {
    constructor(
        private scheduler: IScheduler,
        private analyst: RoomAnalyst,
        private remote: boolean
    ) {}

    generate(): Need[] {
        const safeZone = this.analyst.getSafeZonePosition()

        if(!safeZone) {
            return []
        }

        return [
            new RestAtSafeZoneNeed(this.scheduler, safeZone, this.remote)
        ]
    }

    isActive(): boolean {
        return true
    }
}

export class RestAtSafeZoneNeed implements Need {
    priority = NeedPriority.LAST
    infinite: boolean = true
    roles: CreepRole[] = [CREEP_ROLE_GENERIC, CREEP_ROLE_HAULER, CREEP_ROLE_BUILDER]

    constructor(
        private scheduler: IScheduler,
        private target: RoomPosition,
        public remote: boolean
    ) {}

    generate(actor: Creep): void {
        const parent = this.scheduler.scheduleBackgroundTask(WaitTask, {
            actor: actor,
            ticks: 10
        })

        this.scheduler.scheduleChildTask(parent, MoveTask, {
            actor: actor,
            target: this.target,
            range: 2,
        })
    }
    calculateCost(actor: Creep): number {
        return 0
    }

}
