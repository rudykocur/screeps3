import { CreepRole, CREEP_ROLE_BUILDER } from "../constants";
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

interface Need {
    roles: CreepRole[]

    generate(actor: Creep): void
}

interface ResourceTransferNeed extends Need {
    amount: number
    cost: number
    resource?: Resource
    container?: StructureContainer
    tombstone?: Tombstone
}

class ResourcePickupNeed implements ResourceTransferNeed {
    roles: CreepRole[] = [CREEP_ROLE_HAULER]

    constructor(
        private generator: NeedGenerator,
        private room: RoomManager,
        public amount: number,
        public cost: number,
        public resource: Resource) {}

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
}

class EmptyContainerNeed implements ResourceTransferNeed {
    roles: CreepRole[] = [CREEP_ROLE_HAULER]

    constructor(
        private generator: NeedGenerator,
        private room: RoomManager,
        public amount: number,
        public cost: number,
        public container: StructureContainer) {}

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
}

class BuildSiteNeed implements Need {
    roles: CreepRole[] = [CREEP_ROLE_BUILDER]

    constructor(
        private generator: NeedGenerator,
        private room: RoomManager,
        public site: ConstructionSite) {}

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
}

type NeedTypes = ResourceTransferNeed | EmptyContainerNeed | BuildSiteNeed

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

        const needs = this.generateNeeds()

        for(const actor of jobless) {

            const needIndex = needs.findIndex(need => need.roles.indexOf(role) >= 0)
            if(needIndex < 0) {
                continue
            }

            const need = needs.splice(needIndex, 1)[0]

            if(!need) {
                return
            }

            need.generate(actor)
        }

    }

    generateNeeds(): NeedTypes[] {
        if(!this.room || !this.analyst) {
            return []
        }

        if(!this._needs) {
            const resourceNeeds = this.generateResourceNeeds(this.room)

            const containerNeeds = this.generateMiningSitesNeeds(this.room)

            this._needs = resourceNeeds
                .concat(containerNeeds)
                .concat(this.generateBuildNeeds(this.room))
        }

        return this._needs
    }

    private generateResourceNeeds(room: RoomManager): NeedTypes[] {
        return room.getDroppedResources().map(resource => {
            return new ResourcePickupNeed(
                this,
                room,
                resource.amount,
                0,
                // actor.pos.getRangeTo(resource),
                resource
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
                    container.store.getUsedCapacity(),
                    0,
                    // actor.pos.getRangeTo(container),
                    container
                )
            }) || []
    }

    private generateBuildNeeds(room: RoomManager): NeedTypes[] {
        return this.analyst
            ?.getConstructionSites()
            .map(site => new BuildSiteNeed(this, room, site)) || []
    }

    toString() {
        return `[NeedGenerator ${this.room}]`
    }

}
