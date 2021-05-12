import { CreepRole, CREEP_ROLE_BUILDER } from "../constants"
import { BuildTask } from "tasks/BuildTask"
import { RoomManager } from "tasks/RoomManager"
import { WithdrawEnergy } from "tasks/WithdrawEnergy"
import { LOWEST_PRIORITY, Need, NeedGenerator, NeedsProvider } from "./NeedGenerator"
import { RoomAnalyst } from "tasks/RoomAnalyst"
import { Optional } from "types"

export class BuildNeedProvider implements NeedsProvider {

    constructor(
        private generator: NeedGenerator,
        private room: RoomManager,
        private analyst: RoomAnalyst,
    ) {}

    generate(): Need[] {
        const storedEnergy = this.analyst.getStorage()?.getResourceAmount(RESOURCE_ENERGY)

        if(!storedEnergy || storedEnergy < 300) {
            return []
        }

        return this.analyst
            .getConstructionSites()
            .map(site => new BuildSiteNeed(this.generator, this.room, {site: site})) || []
    }

    isActive() {
        return true
    }

}

export class BuildSiteNeed implements Need {
    roles: CreepRole[] = [CREEP_ROLE_BUILDER]
    infinite = false

    public site: ConstructionSite

    constructor(
        private generator: NeedGenerator,
        private room: RoomManager,
        {site}: {
            site: ConstructionSite
        }) {
            this.site = site
        }

    generate(actor: Creep) {
        const parent = this.generator.scheduleBackgroundTask(BuildTask, {
            actor: actor,
            site: this.site
        })

        this.generator.scheduleChildTask(parent, WithdrawEnergy, {
            actor: actor,
            room: this.room
        })
    }

    calculateCost(actor: Creep) {
        const storeLocation = this.room.getRoomAnalyst()?.getStorage()?.location

        if(!storeLocation) {
            return LOWEST_PRIORITY
        }

        return actor.pos.getRangeTo(storeLocation) + storeLocation.getRangeTo(this.site)
    }

    toString() {
        return `[BuildSiteNeed site=${this.site}]`
    }
}
