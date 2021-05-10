import { CreepRole } from "../constants";
import { RunResult, RunResultType } from "tasks/AbstractTask";
import { PersistentTask } from "tasks/PersistentTask";
import { RoomAnalyst } from "tasks/RoomAnalyst";
import { RoomManager } from "tasks/RoomManager";
import { BuildNeedProvider } from "./BuilderNeeds";
import { ResourcePickupProvider } from "./ResourceNeeds";
import { EmptyContainerNeedProvider } from "./EmptyContainersNeeds";
import { MineNeedsProvider } from "./MineNeeds";
import { GenericNeedsProvider } from "./GenericNeeds";
import { EnergyRefillNeedsProvider } from "./EnergyRefillNeeds";

export const LOWEST_PRIORITY = 99999999

export interface Need {
    roles: CreepRole[]
    infinite: boolean

    generate(actor: Creep): void
    calculateCost(actor: Creep): number
}

export interface NeedsProvider {
    generate(): Need[]
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

        if(this.room) {
            this.providers.push(
                new ResourcePickupProvider(this, this.room),
                new EmptyContainerNeedProvider(this, this.room),
                new EnergyRefillNeedsProvider(this, this.room),
                new MineNeedsProvider(this, this.room),
                new BuildNeedProvider(this, this.room),
                new GenericNeedsProvider(this, this.room),
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
            tasks.find(job => 'getActorId' in job && job.getActorId() === creep.id) === undefined
        )

        if(jobless.length === 0) {
            return
        }

        // console.log(this, `<span style="color: yellow">assigning tasks to ${jobless.length} actors with role [${role}] ...</span>`)

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

    generateNeeds(): Need[] {
        if(!this.room || !this.analyst) {
            return []
        }

        if(!this._needs) {
            // console.log(this, '<span style="color: orange">generating needs ...</span>')
            this._needs = this.providers.map(provider => provider.generate()).reduce((a, b) => a.concat(b));
        }

        return this._needs
    }

    toString() {
        return `[NeedGenerator ${this.room}]`
    }

}
