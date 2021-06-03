import { CreepRole, CREEP_ROLE_BUILDER, CREEP_ROLE_GENERIC } from "../constants"
import { BuildTask } from "tasks/BuildTask"
import { WithdrawEnergy } from "tasks/WithdrawEnergy"
import { RoomAnalyst } from "tasks/RoomAnalyst"
import { PickupResourceTask } from "tasks/PickupResource"
import { GenericTask } from "TaskManager"
import { RepairTask } from "tasks/RepairTask"
import { IRoomManager, IScheduler } from "interfaces"
import { NeedsProvider, Need, LOWEST_PRIORITY, NeedPriority } from "./interfaces"
import { notEmpty } from "utils/common"
import { LoadEnergyTask } from "tasks/LoadEnergyTask"

export class BuildNeedProvider implements NeedsProvider {

    constructor(
        private scheduler: IScheduler,
        private room: IRoomManager,
        private analyst: RoomAnalyst,
        private remote: boolean,
    ) {}

    generate(): Need[] {
        const storage = this.analyst.getStorage()
        const storedEnergy = this.analyst.getStorage()?.getResourceAmount(RESOURCE_ENERGY)

        if(storage?.isConstructed() && (!storedEnergy || storedEnergy < 10000)) {
            return []
        }

        return this.analyst
            .getConstructionSites()
            .map(site => new BuildSiteNeed(this.scheduler, this.room, this.analyst, {site: site, remote: this.remote})) || []
    }

    isActive() {
        return !this.analyst.isRoomAtCritical()
    }
}

export class RemoteBuildNeedProvider extends BuildNeedProvider {
    isActive() {
        return true
    }
}

export class RepairNeedsProvider implements NeedsProvider {
    constructor(
        private scheduler: IScheduler,
        private room: IRoomManager,
        private analyst: RoomAnalyst,
    ) {}
    generate(): Need[] {
        const storage = this.analyst.getStorage()
        const storedEnergy = this.analyst.getStorage()?.getResourceAmount(RESOURCE_ENERGY)

        if(storage?.isConstructed() && (!storedEnergy || storedEnergy < 600)) {
            return []
        }

        return this.analyst.getToRepair().map(obj => new RepairObjectNeed(
            this.scheduler,
            this.room,
            this.analyst,
            {
                target: obj
            }
        ))
    }
    isActive(): boolean {
        return !this.analyst.isRoomAtCritical()
    }
}

export abstract class DoActionWithEnergyNeed implements Need {
    roles: CreepRole[] = [CREEP_ROLE_BUILDER]
    infinite = false
    priority = NeedPriority.NORMAL

    constructor(
        protected scheduler: IScheduler,
        protected room: IRoomManager,
        protected analyst: RoomAnalyst
    ) {}

    abstract generateParentTask(actor: Creep): GenericTask

    abstract getTargetPos(): RoomPosition

    generate(actor: Creep) {
        const parent = this.generateParentTask(actor)

        if(this.analyst.getStorage()?.isConstructed()) {
            this.scheduler.scheduleChildTask(parent, WithdrawEnergy, {
                actor: actor,
                room: this.room
            })
        }
        else {
            const resources = this.room.getDroppedResources(true)

            if(resources.length > 0) {
                let nearest;

                if(actor.pos.roomName === this.room.name) {
                    nearest = actor.pos.findClosestByRange(resources)
                }
                else {
                    nearest = resources[0]
                }

                this.scheduler.scheduleChildTask(parent, PickupResourceTask, {
                    actor: actor,
                    resource: nearest
                })
            }
            else {
                const containers = this.analyst.getMiningSites()
                    .filter(site => (site.container?.store.getUsedCapacity(RESOURCE_ENERGY) || 0) > 300)
                    .map(site => site.container)
                    .filter(notEmpty)

                if(containers.length > 0) {
                    let nearest: StructureContainer;

                    if(actor.pos.roomName === this.room.name) {
                        nearest = actor.pos.findClosestByRange(containers) || containers[0]
                    }
                    else {
                        nearest = containers[0]
                    }

                    this.scheduler.scheduleChildTask(parent, LoadEnergyTask, {
                        actor: actor,
                        container: nearest
                    })
                }
            }
        }
    }

    calculateCost(actor: Creep) {
        const storeLocation = this.room.getRoomAnalyst()?.getStorage()?.location

        if(!storeLocation) {
            return LOWEST_PRIORITY
        }

        return actor.pos.getRangeTo(storeLocation) + storeLocation.getRangeTo(this.getTargetPos())
    }
}

export class BuildSiteNeed extends DoActionWithEnergyNeed {

    roles: CreepRole[] = [CREEP_ROLE_BUILDER, CREEP_ROLE_GENERIC]

    public site: ConstructionSite
    public remote: boolean

    constructor(
        scheduler: IScheduler,
        room: IRoomManager,
        analyst: RoomAnalyst,
        {site, remote}: {
            site: ConstructionSite,
            remote: boolean,
        }) {
            super(scheduler, room, analyst)
            this.site = site
            this.remote = remote
        }

    generateParentTask(actor: Creep) {
        return this.scheduler.scheduleBackgroundTask(BuildTask, {
            actor: actor,
            site: this.site
        })
    }

    getTargetPos() {
        return this.site.pos
    }

    toString() {
        return `[BuildSiteNeed site=${this.site}]`
    }
}

export class RepairObjectNeed extends DoActionWithEnergyNeed {

    public target: Structure
    roles: CreepRole[] = [CREEP_ROLE_BUILDER, CREEP_ROLE_GENERIC]

    constructor(
        scheduler: IScheduler,
        room: IRoomManager,
        analyst: RoomAnalyst,
        {target}: {
            target: Structure
        }) {
            super(scheduler, room, analyst)
            this.target = target
        }

    generateParentTask(actor: Creep) {
        return this.scheduler.scheduleBackgroundTask(RepairTask, {
            actor: actor,
            structure: this.target
        })
    }

    getTargetPos() {
        return this.target.pos
    }

    toString() {
        return `[RepairObjectNeed target=${this.target}]`
    }
}
