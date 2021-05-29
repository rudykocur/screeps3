import { IRoomManager, IScheduler } from "interfaces";
import { FillExtensionClusterTask } from "tasks/FillExtensionClusterTask";
import { ExtensionCluster, RoomAnalyst } from "tasks/RoomAnalyst";
import { TransferResourceTask } from "tasks/TransferResourceTask";
import { WithdrawEnergy } from "tasks/WithdrawEnergy";
import { StructureWithEnergyStorage } from "types";
import { CreepRole, CREEP_ROLE_GENERIC, CREEP_ROLE_HAULER } from "../constants";
import { NeedsProvider, Need, LOWEST_PRIORITY, NeedPriority } from "./interfaces";

export class EnergyRefillNeedsProvider implements NeedsProvider {

    protected roles?: CreepRole[] = undefined

    constructor(
        private scheduler: IScheduler,
        private room: IRoomManager,
        protected analyst: RoomAnalyst
    ) {}

    generate(): Need[] {
        const storedEnergy = this.room.getRoomAnalyst()?.getStorage()?.getResourceAmount(RESOURCE_ENERGY)

        const extensionCapacity = EXTENSION_ENERGY_CAPACITY[this.analyst.getRCL()]

        if(!storedEnergy || storedEnergy < extensionCapacity) {
            return []
        }

        return this.analyst
            .getExtensions()
            .filter(ext => ext.store.getFreeCapacity(RESOURCE_ENERGY) > 0)
            .map(ext => {
                return new EnergyRefillNeed(this.scheduler, this.room, {
                    target: ext,
                    amount: extensionCapacity,
                    roles: this.roles,
                })
            }) || []
    }

    isActive() {
        return false
    }
}

export class SpawnRefillNeedsProvider implements NeedsProvider {
    protected roles?: CreepRole[] = undefined

    constructor(
        private scheduler: IScheduler,
        private room: IRoomManager,
        protected analyst: RoomAnalyst
    ) {}

    generate(): Need[] {
        const storedEnergy = this.room.getRoomAnalyst()?.getStorage()?.getResourceAmount(RESOURCE_ENERGY)

        const extensionCapacity = EXTENSION_ENERGY_CAPACITY[this.analyst.getRCL()]

        if(!storedEnergy || storedEnergy < extensionCapacity) {
            return []
        }

        return this.analyst
            .getSpawns()
            .map(spawn => {
                const reserved = Game.reservationManager.getHandler(spawn)?.getReservedAmount() || 0

                return {
                    missing: spawn.store.getFreeCapacity(RESOURCE_ENERGY) - reserved,
                    obj: spawn,
                }
            })
            .filter(data => data.missing > 0)
            .filter(data => data.missing <= storedEnergy)
            .map(data => {
                return new EnergyRefillNeed(this.scheduler, this.room, {
                    target: data.obj,
                    amount: data.missing,
                    roles: this.roles,
                })
            }) || []
    }

    isActive() {
        return true
    }
}

export class SpawnRefillAtCriticalNeedProvider extends SpawnRefillNeedsProvider {
    roles = [CREEP_ROLE_GENERIC]

    isActive() {
        return this.analyst.isRoomAtCritical()
    }
}

export class TowerRefillNeedsProvider implements NeedsProvider {

    protected roles?: CreepRole[] = undefined

    constructor(
        private scheduler: IScheduler,
        private room: IRoomManager,
        protected analyst: RoomAnalyst
    ) {}

    generate(): Need[] {
        const storedEnergy = this.room.getRoomAnalyst()?.getStorage()?.getResourceAmount(RESOURCE_ENERGY)

        if(!storedEnergy) {
            return []
        }

        return this.analyst
            .getTowers()
            .filter(tower => tower.store.getFreeCapacity(RESOURCE_ENERGY) > 300)
            .filter(tower => tower.store.getFreeCapacity(RESOURCE_ENERGY) <= storedEnergy)
            .map(tower => {
                return new EnergyRefillNeed(this.scheduler, this.room, {
                    target: tower,
                    amount: tower.store.getFreeCapacity(RESOURCE_ENERGY),
                    roles: this.roles,
                })
            }) || []
    }

    isActive() {
        return !this.analyst.isRoomAtCritical()
    }
}

export class ExtensionClusterNeedsProvider implements NeedsProvider {
    constructor(
        private scheduler: IScheduler,
        private room: IRoomManager,
        protected analyst: RoomAnalyst
    ) {}

    generate(): Need[] {
        const storedEnergy = this.room.getRoomAnalyst()?.getStorage()?.getResourceAmount(RESOURCE_ENERGY)

        if(!storedEnergy) {
            return []
        }

        return this.analyst.getExtensionClusters()
            .filter(cluster => {
                const reserved = Game.reservationManager.getHandler(cluster)?.getReservedAmount() || 0
                const missingEnergyAmount = cluster.getMissingEnergyAmount() - reserved

                if(missingEnergyAmount <= 0) {
                    return false
                }

                if(missingEnergyAmount > storedEnergy) {
                    return false
                }

                return true
            })
            .map(cluster => new ExtensionClusterRefillNeed(this.scheduler, this.room, {
                cluster: cluster,
                amount: cluster.getMissingEnergyAmount() - (Game.reservationManager.getHandler(cluster)?.getReservedAmount() || 0)
            }))
    }

    isActive(): boolean {
        return true
    }

}

export class EnergyRefillAtCriticalNeedProvider extends EnergyRefillNeedsProvider {
    roles = [CREEP_ROLE_GENERIC]

    isActive() {
        return this?.analyst.isRoomAtCritical() || false
    }
}

export class ExtensionClusterRefillNeed implements Need {
    roles: CreepRole[] = [CREEP_ROLE_HAULER]
    infinite = false
    priority = NeedPriority.HIGH

    cluster: ExtensionCluster
    amount: number

    constructor(
        private scheduler: IScheduler,
        private room: IRoomManager,
        {cluster, amount, roles}: {
            cluster: ExtensionCluster,
            amount: number,
            roles?: CreepRole[]
        }) {
            this.cluster = cluster
            this.amount = amount

            if(roles) {
                this.roles = roles
            }
        }

    generate(actor: Creep): void {
        const parent = this.scheduler.scheduleBackgroundTask(FillExtensionClusterTask, {
            actor: actor,
            cluster: this.cluster
        })

        parent.reserveResouces()

        this.scheduler.scheduleChildTask(parent, WithdrawEnergy, {
            actor: actor,
            room: this.room,
            amount: this.amount
        })
    }

    calculateCost(actor: Creep): number {
        const storeLocation = this.room.getRoomAnalyst()?.getStorage()?.location

        if(!storeLocation) {
            return LOWEST_PRIORITY
        }

        const cost = actor.pos.getRangeTo(storeLocation) + storeLocation.getRangeTo(this.cluster.center)
        return cost
    }

    toString() {
        return `[ExtensionClusterRefillNeed cluster=${this.cluster} amount=${this.amount}]`
    }
}

export class EnergyRefillNeed implements Need {
    roles: CreepRole[] = [CREEP_ROLE_HAULER]
    infinite: boolean = false
    priority = NeedPriority.NORMAL

    target: StructureWithEnergyStorage
    amount: number

    constructor(
        private scheduler: IScheduler,
        private room: IRoomManager,
        {target, amount, roles}: {
            target: StructureWithEnergyStorage,
            amount: number,
            roles?: CreepRole[]
        }) {
            this.target = target
            this.amount = amount

            if(roles) {
                this.roles = roles
            }
        }

    generate(actor: Creep): void {
        const parent = this.scheduler.scheduleBackgroundTask(TransferResourceTask, {
            actor: actor,
            structure: this.target
        })

        parent.reserveResouces(this.amount)

        this.scheduler.scheduleChildTask(parent, WithdrawEnergy, {
            actor: actor,
            room: this.room,
            amount: Math.min(this.amount, actor.store.getFreeCapacity())
        })
    }

    calculateCost(actor: Creep): number {
        const storeLocation = this.room.getRoomAnalyst()?.getStorage()?.location

        if(!storeLocation) {
            return LOWEST_PRIORITY
        }

        const cost = actor.pos.getRangeTo(storeLocation) + storeLocation.getRangeTo(this.target)
        return cost
    }

    toString() {
        return `[EnergyRefillNeed target=${this.target}]`
    }

}
