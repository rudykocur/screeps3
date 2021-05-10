import { CreepRole, CREEP_ROLE_GENERIC } from "../constants"
import { RoomManager } from "tasks/RoomManager"
import { UpgradeControllerTask } from "tasks/UpgradeControllerTask"
import { WithdrawEnergy } from "tasks/WithdrawEnergy"
import { Need, NeedGenerator, LOWEST_PRIORITY, NeedsProvider } from "./NeedGenerator"

export class GenericNeedsProvider implements NeedsProvider {

    constructor(
        private generator: NeedGenerator,
        private room: RoomManager
    ) {}

    generate(): Need[] {
        const storedEnergy = this.room.getRoomAnalyst()?.getStorage()?.getResourceAmount(RESOURCE_ENERGY)

        if(!storedEnergy || storedEnergy < 300) {
            return []
        }

        return [
            new UpgradeControllerNeed(this.generator, this.room)
        ]
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
}
