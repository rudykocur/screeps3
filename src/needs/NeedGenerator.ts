import { CreepRole } from "../constants";
import { RunResult, RunResultType } from "tasks/AbstractTask";
import { PersistentTask } from "tasks/PersistentTask";
import { RoomAnalyst } from "tasks/RoomAnalyst";
import { RoomManager } from "tasks/RoomManager";
import { BuildNeedProvider, RepairNeedsProvider } from "./BuilderNeeds";
import { ResourcePickupProvider } from "./ResourceNeeds";
import { EmptyContainerAtCriticalNeedProvider, EmptyContainerNeedProvider } from "./EmptyContainersNeeds";
import { MineNeedsProvider } from "./MineNeeds";
import { GenericNeedsProvider, HarvestEnergyAtCriticalNeedsProvider } from "./GenericNeeds";
import { EnergyRefillAtCriticalNeedProvider, EnergyRefillNeedsProvider, ExtensionClusterNeedsProvider } from "./EnergyRefillNeeds";

export const LOWEST_PRIORITY = 99999999

export interface Need {
    roles: CreepRole[]
    infinite: boolean

    generate(actor: Creep): void
    calculateCost(actor: Creep): number
}

export interface NeedsProvider {
    generate(): Need[]
    isActive(): boolean
}

export interface ResourceTransferNeed extends Need {
    amount: number
    resource?: Resource
    container?: StructureContainer
    tombstone?: Tombstone
}

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
    private _needs?: Need[]
    private providers: NeedsProvider[] = []

    initMemory(args: NeedGeneratorArgs): NeedGeneratorMemory {
        return {
            roomName: args.room.name
        }
    }

    doInit(): void {
        this.room = Game.manager.getRoomManager(this.memory.roomName)
        this.analyst = this.room?.getRoomAnalyst()

        if(this.room && this.analyst) {
            this.providers.push(
                new ResourcePickupProvider(this, this.room, this.analyst),
                new EmptyContainerNeedProvider(this, this.room, this.analyst),
                new EnergyRefillNeedsProvider(this, this.room, this.analyst),
                new ExtensionClusterNeedsProvider(this, this.room, this.analyst),
                new MineNeedsProvider(this, this.analyst),
                new BuildNeedProvider(this, this.room, this.analyst),
                new RepairNeedsProvider(this, this.room, this.analyst),
                new GenericNeedsProvider(this, this.room, this.analyst),
                new EmptyContainerAtCriticalNeedProvider(this, this.room, this.analyst),
                new EnergyRefillAtCriticalNeedProvider(this, this.room, this.analyst),
                new HarvestEnergyAtCriticalNeedsProvider(this, this.room, this.analyst)
            )
        }
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
            tasks.find(job => {
                if(!('getActorId' in job)) {
                    console.log(`<span style="color: red">Task ${job} does not have actorId!!!</span>`)
                }
                return 'getActorId' in job && job.getActorId() === creep.id
            }) === undefined
        )

        if(jobless.length === 0) {
            return
        }

        const needs = this.generateNeeds()

        // console.log(this, `<span style="color: yellow">assigning tasks to ${jobless.length} actors with role [${role}] ...</span>`)
        // console.log(this, `generated needs (${needs.length}): ${needs}`)

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

    generateNeeds(): Need[] {
        if(!this.room || !this.analyst) {
            return []
        }

        if(!this._needs) {
            this._needs = this.providers
                .filter(provider => provider.isActive())
                .map(provider => provider.generate()).reduce((a, b) => a.concat(b));
        }

        return this._needs
    }

    toString() {
        return `[NeedGenerator ${this.room}]`
    }

}
