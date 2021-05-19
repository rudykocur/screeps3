import { FillExtensionClusterTask } from "tasks/FillExtensionClusterTask";
import { ExtensionCluster, RoomAnalyst } from "tasks/RoomAnalyst";
import { RoomManager } from "tasks/RoomManager";
import { TransferResourceTask } from "tasks/TransferResourceTask";
import { WithdrawEnergy } from "tasks/WithdrawEnergy";
import { StructureWithEnergyStorage } from "types";
import { CreepRole, CREEP_ROLE_GENERIC, CREEP_ROLE_HAULER } from "../constants";
import { LOWEST_PRIORITY, Need, NeedGenerator, NeedsProvider } from "./NeedGenerator";

export class EnergyRefillNeedsProvider implements NeedsProvider {

    protected roles?: CreepRole[] = undefined

    constructor(
        private generator: NeedGenerator,
        private room: RoomManager,
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
                return new EnergyRefillNeed(this.generator, this.room, {
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
        private generator: NeedGenerator,
        private room: RoomManager,
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
            .filter(obj => obj.store.getFreeCapacity(RESOURCE_ENERGY) > 0)
            .filter(obj => obj.store.getFreeCapacity(RESOURCE_ENERGY) <= storedEnergy)
            .map(obj => {
                return new EnergyRefillNeed(this.generator, this.room, {
                    target: obj,
                    amount: obj.store.getFreeCapacity(RESOURCE_ENERGY),
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
        private generator: NeedGenerator,
        private room: RoomManager,
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
                return new EnergyRefillNeed(this.generator, this.room, {
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
        private generator: NeedGenerator,
        private room: RoomManager,
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
            .map(cluster => new ExtensionClusterRefillNeed(this.generator, this.room, {
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

    cluster: ExtensionCluster
    amount: number

    constructor(
        private generator: NeedGenerator,
        private room: RoomManager,
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
        const parent = this.generator.scheduleBackgroundTask(FillExtensionClusterTask, {
            actor: actor,
            cluster: this.cluster
        })

        parent.reserveResouces()

        this.generator.scheduleChildTask(parent, WithdrawEnergy, {
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
    roles: CreepRole[] = [CREEP_ROLE_HAULER];
    infinite: boolean = false;

    target: StructureWithEnergyStorage
    amount: number

    constructor(
        private generator: NeedGenerator,
        private room: RoomManager,
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
        const parent = this.generator.scheduleBackgroundTask(TransferResourceTask, {
            actor: actor,
            structure: this.target
        })

        this.generator.scheduleChildTask(parent, WithdrawEnergy, {
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
