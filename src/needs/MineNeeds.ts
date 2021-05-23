import { CreepRole, CREEP_ROLE_MINER } from "../constants"
import { MinerCreep } from "tasks/creeps/MinerCreep"
import { RoomAnalyst } from "tasks/RoomAnalyst"
import { IScheduler } from "interfaces"
import { NeedsProvider, Need, NeedPriority } from "./interfaces"

export class MineNeedsProvider implements NeedsProvider {

    constructor(
        private scheduler: IScheduler,
        private analyst: RoomAnalyst,
        private remote: boolean,
    ) {}

    generate(): Need[] {
        const sites = this.analyst.getMiningSites()

        const tasks = this.scheduler.findTasks(MinerCreep)

        const freeSites = sites.filter(site =>
            tasks.find(job => job.getSourceId() === site.source.id) === undefined
        )

        return freeSites.map(site => new MineSourceNeed(this.scheduler, {
            source: site.source,
            container: site.container,
            remote: this.remote
        }))
    }

    isActive() {
        return true
    }

    toString() {
        return `[MineNeedsProvider]`
    }
}

export class MineSourceNeed implements Need {
    roles: CreepRole[] = [CREEP_ROLE_MINER]
    infinite = false
    priority = NeedPriority.NORMAL

    remote: boolean

    source: Source
    container?: StructureContainer | null

    constructor(
        private scheduler: IScheduler,
        {source, container, remote}: {
            source: Source,
            container?: StructureContainer | null
            remote: boolean
        }
    ) {
        this.source = source
        this.container = container
        this.remote = remote
    }

    generate(actor: Creep) {
        this.scheduler.scheduleBackgroundTask(MinerCreep, {
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
