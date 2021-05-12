import { CreepRole, CREEP_ROLE_MINER } from "../constants"
import { MinerCreep } from "tasks/creeps/MinerCreep"
import { Need, NeedGenerator, NeedsProvider } from "./NeedGenerator"
import { RoomAnalyst } from "tasks/RoomAnalyst"
import { RoomManager } from "tasks/RoomManager"
import { Optional } from "types"

export class MineNeedsProvider implements NeedsProvider {

    private analyst?: Optional<RoomAnalyst>

    constructor(
        private generator: NeedGenerator,
        private room: RoomManager
    ) {
        this.analyst = this.room?.getRoomAnalyst()
    }

    generate(): Need[] {
        const sites = this.analyst?.getMiningSites() || []

        const tasks = this.generator.findTasks(MinerCreep)

        const freeSites = sites.filter(site =>
            tasks.find(job => job.getSourceId() === site.source.id) === undefined
        )

        return freeSites.map(site => new MineSourceNeed(this.generator, {
            source: site.source,
            container: site.container
        }))
    }
}

export class MineSourceNeed implements Need {
    roles: CreepRole[] = [CREEP_ROLE_MINER]
    infinite = false

    source: Source
    container?: StructureContainer | null

    constructor(
        private generator: NeedGenerator,
        {source, container}: {
            source: Source,
            container?: StructureContainer | null
        }
    ) {
        this.source = source
        this.container = container
    }

    generate(actor: Creep) {
        this.generator.scheduleBackgroundTask(MinerCreep, {
            actor: actor,
            source: this.source,
            container: this.container
        })
    }

    calculateCost(actor: Creep) {
        return 0
    }

    toString() {
        return `[MineSourceNeed source=${this.source}]`
    }
}
