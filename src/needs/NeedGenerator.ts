import { CreepRole, CREEP_ROLE_BUILDER, CREEP_ROLE_GENERIC, CREEP_ROLE_MINER } from "../constants";
import { CREEP_ROLE_HAULER } from "../constants";
import { RunResult, RunResultType } from "tasks/AbstractTask";
import { DepositEnergy } from "tasks/DepositEnergy";
import { LoadEnergyTask } from "tasks/LoadEnergyTask";
import { PersistentTask } from "tasks/PersistentTask";
import { PickupResourceTask } from "tasks/PickupResource";
import { RoomAnalyst } from "tasks/RoomAnalyst";
import { RoomManager } from "tasks/RoomManager";
import { notEmpty } from "utils/common";
import { BuildTask } from "tasks/BuildTask";
import { WithdrawEnergy } from "tasks/WithdrawEnergy";
import { MinerCreep } from "tasks/creeps/MinerCreep";
import { UpgradeControllerTask } from "tasks/UpgradeControllerTask";

const LOWEST_PRIORITY = 99999999

interface Need {
    roles: CreepRole[]
    infinite: boolean

    generate(actor: Creep): void
    calculateCost(actor: Creep): number
}

interface ResourceTransferNeed extends Need {
    amount: number
    resource?: Resource
    container?: StructureContainer
    tombstone?: Tombstone
}

class ResourcePickupNeed implements ResourceTransferNeed {
    roles: CreepRole[] = [CREEP_ROLE_HAULER]
    infinite = false

    public amount: number
    public resource: Resource

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

        return actor.pos.getRangeTo(this.resource) + this.resource.pos.getRangeTo(storeLocation)
    }
}

class EmptyContainerNeed implements ResourceTransferNeed {
    roles: CreepRole[] = [CREEP_ROLE_HAULER]
    infinite = false

    public amount: number
    public container: StructureContainer

    constructor(
        private generator: NeedGenerator,
        private room: RoomManager,
        {amount, container}: {
            amount: number,
            container: StructureContainer
        }
        ) {
            this.amount = amount
            this.container = container
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
}

class BuildSiteNeed implements Need {
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
}

class MineSourceNeed implements Need {
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
}

class UpgradeControllerNeed implements Need {
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


type NeedTypes = ResourceTransferNeed | EmptyContainerNeed | BuildSiteNeed | MineSourceNeed | UpgradeControllerNeed

interface NeedGeneratorMemory {
    roomName: string
}

interface NeedGeneratorArgs {
    room: RoomManager
}

@PersistentTask.register
export class NeedGenerator extends PersistentTask<NeedGeneratorMemory, NeedGeneratorArgs> {

    private room?: RoomManager | null
    private analyst?: RoomAnalyst | null
    private _needs?: NeedTypes[]

    initMemory(args: NeedGeneratorArgs): NeedGeneratorMemory {
        return {
            roomName: args.room.name
        }
    }

    doInit(): void {
        this.room = Game.manager.getRoomManager(this.memory.roomName)
        this.analyst = this.room?.getRoomAnalyst()
    }

    doRun(): RunResultType {
        if(!this.room || !this.analyst) {
            return RunResult.DONE
        }
    }

    assignTasks(actors: Creep[]) {
        if(actors.length === 0) {
            return
        }

        const role = actors[0].memory.role

        const tasks = this.getChildTasks()

        const jobless = actors.filter(creep =>
            tasks.find(job => 'getActorId' in job && job.getActorId() === creep.id) === undefined
        )

        if(jobless.length === 0) {
            return
        }

        console.log(this, `<span style="color: yellow">assigning tasks to ${jobless.length} actors with role [${role}] ...</span>`)

        const needs = this.generateNeeds()

        for(const actor of jobless) {

            const applicableNeeds = needs.filter(need => need.roles.indexOf(role) >= 0)
            const sortedNeeds = applicableNeeds
                .map(need => {return {need, cost: need.calculateCost(actor)}})
                .sort((a, b) => a.cost - b.cost)
                .map(item => item.need)

            const cheapestNeed = sortedNeeds[0]

            const needIndex = needs.findIndex(need => need === cheapestNeed)
            if(needIndex < 0) {
                continue
            }

            cheapestNeed.generate(actor)

            if(!cheapestNeed.infinite) {
                needs.splice(needIndex, 1)
            }
        }
    }

    generateNeeds(): NeedTypes[] {
        if(!this.room || !this.analyst) {
            return []
        }

        if(!this._needs) {
            console.log(this, '<span style="color: orange">generating needs ...</span>')
            const resourceNeeds = this.generateResourceNeeds(this.room)

            const containerNeeds = this.generateMiningSitesNeeds(this.room)

            this._needs = resourceNeeds
                .concat(containerNeeds)
                .concat(this.generateBuildNeeds(this.room))
                .concat(this.generateMinerNeeds(this.room))
                .concat(this.generateUpgradeNeeds(this.room))
        }

        return this._needs
    }

    private generateResourceNeeds(room: RoomManager): NeedTypes[] {
        return room.getDroppedResources().map(resource => {
            return new ResourcePickupNeed(
                this,
                room,
                 {
                     amount: resource.amount,
                     resource: resource
                 }
            )
        })
    }

    private generateMiningSitesNeeds(room: RoomManager): NeedTypes[] {
        return this.analyst
            ?.getMiningSites()
            .map(site => site.container)
            .filter(notEmpty)
            .filter(container => container.store.getUsedCapacity() > 100)
            .map(container => {
                return new EmptyContainerNeed(
                    this,
                    room,
                    {
                        amount: container.store.getUsedCapacity(),
                        container: container
                    }
                )
            }) || []
    }

    private generateBuildNeeds(room: RoomManager): NeedTypes[] {
        const storedEnergy = room.getRoomAnalyst()?.getStorage()?.getResourceAmount(RESOURCE_ENERGY)

        if(!storedEnergy || storedEnergy < 300) {
            return []
        }

        return this.analyst
            ?.getConstructionSites()
            .map(site => new BuildSiteNeed(this, room, {site: site})) || []
    }

    private generateMinerNeeds(room: RoomManager): NeedTypes[] {
        const sites = this.analyst?.getMiningSites() || []

        const tasks = this.findTasks(MinerCreep)

        const freeSites = sites.filter(site =>
            tasks.find(job => job.getSourceId() === site.source.id) === undefined
        )

        return freeSites.map(site => new MineSourceNeed(this, {
            source: site.source,
            container: site.container
        }))
    }

    private generateUpgradeNeeds(room: RoomManager): NeedTypes[] {
        const storedEnergy = room.getRoomAnalyst()?.getStorage()?.getResourceAmount(RESOURCE_ENERGY)

        if(!storedEnergy || storedEnergy < 300) {
            return []
        }

        return [
            new UpgradeControllerNeed(this, room)
        ]
    }

    toString() {
        return `[NeedGenerator ${this.room}]`
    }

}
