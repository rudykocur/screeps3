import { FillExtensionClusterTask } from "tasks/FillExtensionClusterTask";
import { ExtensionCluster, RoomAnalyst } from "tasks/RoomAnalyst";
import { RoomManager } from "tasks/RoomManager";
import { TransferResourceTask } from "tasks/TransferResourceTask";
import { WithdrawEnergy } from "tasks/WithdrawEnergy";
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
                return new ExtensionRefillNeed(this.generator, this.room, {
                    extension: ext,
                    amount: extensionCapacity,
                    roles: this.roles,
                })
            }) || []
    }

    isActive() {
        return false
    }
}

export class ExtensionClusterNeedsProvider implements NeedsProvider {
    constructor(
        private generator: NeedGenerator,
        private room: RoomManager,
        protected analyst: RoomAnalyst
    ) {}

    generate(): Need[] {
        return this.analyst.getExtensionClusters()
            .filter(cluster => {
                const reserved = Game.reservationManager.getHandler(cluster)?.getReservedAmount() || 0
                return (cluster.getMissingEnergyAmount() - reserved) > 0
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
        if(!this.analyst) {
            return false
        }

        return this.analyst.isRoomAtCritical()
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

export class ExtensionRefillNeed implements Need {
    roles: CreepRole[] = [CREEP_ROLE_HAULER];
    infinite: boolean = false;

    weight: number = 0.7

    extension: StructureExtension
    amount: number

    constructor(
        private generator: NeedGenerator,
        private room: RoomManager,
        {extension, amount, roles}: {
            extension: StructureExtension,
            amount: number,
            roles?: CreepRole[]
        }) {
            this.extension = extension
            this.amount = amount

            if(roles) {
                this.roles = roles
            }
        }

    generate(actor: Creep): void {
        const parent = this.generator.scheduleBackgroundTask(TransferResourceTask, {
            actor: actor,
            structure: this.extension
        })

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

        const cost = actor.pos.getRangeTo(storeLocation) + storeLocation.getRangeTo(this.extension)
        return cost * this.weight
    }

    toString() {
        return `[EnergyRefillNeed extension=${this.extension}]`
    }

}
