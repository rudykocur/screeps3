import { CreepRole, CREEP_ROLE_GENERIC } from "../constants"
import { RoomManager } from "tasks/RoomManager"
import { UpgradeControllerTask } from "tasks/UpgradeControllerTask"
import { WithdrawEnergy } from "tasks/WithdrawEnergy"
import { Need, NeedGenerator, LOWEST_PRIORITY, NeedsProvider } from "./NeedGenerator"
import { Optional } from "types"
import { RoomAnalyst } from "tasks/RoomAnalyst"
import { HarvestAndLoadTask } from "tasks/HarvestAndLoadTask"
import { DepositEnergy } from "tasks/DepositEnergy"

export class GenericNeedsProvider implements NeedsProvider {

    constructor(
        private generator: NeedGenerator,
        private room: RoomManager,
        private analyst: RoomAnalyst,
    ) {}

    generate(): Need[] {
        const storedEnergy = this.analyst.getStorage()?.getResourceAmount(RESOURCE_ENERGY)

        if(!storedEnergy || storedEnergy < 1000) {
            return []
        }

        return [
            new UpgradeControllerNeed(this.generator, this.room)
        ]
    }

    isActive() {
        return !this.analyst.isRoomAtCritical()
    }
}

export class HarvestEnergyAtCriticalNeedsProvider implements NeedsProvider {

    constructor(
        private generator: NeedGenerator,
        private room: RoomManager,
        private analyst: RoomAnalyst,
    ) {}

    generate(): Need[] {
        return this.analyst.getSafeSources().map(source => {
            return new HarvestEnergyNeed(this.generator, this.room, {
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

    private source: Source

    constructor(
        private generator: NeedGenerator,
        private room: RoomManager,
        {source}: {
            source: Source
        }) {
            this.source = source
        }

    generate(actor: Creep) {
        const parent = this.generator.scheduleBackgroundTask(DepositEnergy, {
            actor: actor,
            room: this.room,
        })

        this.generator.scheduleChildTask(parent, HarvestAndLoadTask, {
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

    constructor(
        private generator: NeedGenerator,
        private room: RoomManager) {}

    generate(actor: Creep) {
        const parent = this.generator.scheduleBackgroundTask(UpgradeControllerTask, {
            actor: actor,
            room: this.room
        })

        this.generator.scheduleChildTask(parent, WithdrawEnergy, {
            actor: actor,
            room: this.room
        })
    }

    calculateCost(actor: Creep) {
        return LOWEST_PRIORITY
    }

    toString() {
        return `[UpgradeControllerNeed room=${this.room.name}]`
    }
}
