import { CreepRole, CREEP_ROLE_BUILDER } from "../constants"
import { BuildTask } from "tasks/BuildTask"
import { RoomManager } from "tasks/RoomManager"
import { WithdrawEnergy } from "tasks/WithdrawEnergy"
import { LOWEST_PRIORITY, Need, NeedGenerator, NeedsProvider } from "./NeedGenerator"
import { RoomAnalyst } from "tasks/RoomAnalyst"
import { Optional } from "types"
import { PickupResourceTask } from "tasks/PickupResource"
import { GenericTask } from "TaskManager"
import { RepairTask } from "tasks/RepairTask"

export class BuildNeedProvider implements NeedsProvider {

    constructor(
        private generator: NeedGenerator,
        private room: RoomManager,
        private analyst: RoomAnalyst,
    ) {}

    generate(): Need[] {
        const storage = this.analyst.getStorage()
        const storedEnergy = this.analyst.getStorage()?.getResourceAmount(RESOURCE_ENERGY)

        if(storage?.isConstructed() && (!storedEnergy || storedEnergy < 600)) {
            return []
        }

        return this.analyst
            .getConstructionSites()
            .map(site => new BuildSiteNeed(this.generator, this.room, this.analyst, {site: site})) || []
    }

    isActive() {
        return !this.analyst.isRoomAtCritical()
    }
}

export class RepairNeedsProvider implements NeedsProvider {
    constructor(
        private generator: NeedGenerator,
        private room: RoomManager,
        private analyst: RoomAnalyst,
    ) {}
    generate(): Need[] {
        const storage = this.analyst.getStorage()
        const storedEnergy = this.analyst.getStorage()?.getResourceAmount(RESOURCE_ENERGY)

        if(storage?.isConstructed() && (!storedEnergy || storedEnergy < 600)) {
            return []
        }

        return this.analyst.getToRepair().map(obj => new RepairObjectNeed(
            this.generator,
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

    constructor(
        protected generator: NeedGenerator,
        protected room: RoomManager,
        protected analyst: RoomAnalyst
    ) {}

    abstract generateParentTask(actor: Creep): GenericTask

    abstract getTargetPos(): RoomPosition

    generate(actor: Creep) {
        const parent = this.generateParentTask(actor)

        const storage = this.analyst.getStorage()

        if(this.analyst.getStorage()?.isConstructed()) {
            this.generator.scheduleChildTask(parent, WithdrawEnergy, {
                actor: actor,
                room: this.room
            })
        }
        else {
            const resources = this.room.getDroppedResources(true)

            if(resources.length > 0) {
                const nearest = actor.pos.findClosestByRange(resources);
                this.generator.scheduleChildTask(parent, PickupResourceTask, {
                    actor: actor,
                    resource: nearest
                })
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

    public site: ConstructionSite

    constructor(
        generator: NeedGenerator,
        room: RoomManager,
        analyst: RoomAnalyst,
        {site}: {
            site: ConstructionSite
        }) {
            super(generator, room, analyst)
            this.site = site
        }

    generateParentTask(actor: Creep) {
        return this.generator.scheduleBackgroundTask(BuildTask, {
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

    constructor(
        generator: NeedGenerator,
        room: RoomManager,
        analyst: RoomAnalyst,
        {target}: {
            target: Structure
        }) {
            super(generator, room, analyst)
            this.target = target
        }

    generateParentTask(actor: Creep) {
        return this.generator.scheduleBackgroundTask(RepairTask, {
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
