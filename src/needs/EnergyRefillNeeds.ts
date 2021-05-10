import { RoomAnalyst } from "tasks/RoomAnalyst";
import { RoomManager } from "tasks/RoomManager";
import { TransferResourceTask } from "tasks/TransferResourceTask";
import { WithdrawEnergy } from "tasks/WithdrawEnergy";
import { Optional } from "types";
import { CreepRole, CREEP_ROLE_HAULER } from "../constants";
import { LOWEST_PRIORITY, Need, NeedGenerator, NeedsProvider } from "./NeedGenerator";

export class EnergyRefillNeedsProvider implements NeedsProvider {

    private analyst?: Optional<RoomAnalyst>

    constructor(
        private generator: NeedGenerator,
        private room: RoomManager
    ) {
        this.analyst = this.room?.getRoomAnalyst()
    }

    generate(): Need[] {
        if(!this.room || !this.analyst) {
            return []
        }

        const storedEnergy = this.room.getRoomAnalyst()?.getStorage()?.getResourceAmount(RESOURCE_ENERGY)

        const extensionCapacity = EXTENSION_ENERGY_CAPACITY[this.analyst.getRCL()]

        if(!storedEnergy || storedEnergy < extensionCapacity) {
            return []
        }

        return this.analyst
            ?.getExtensions()
            .filter(ext => ext.store.getFreeCapacity(RESOURCE_ENERGY) > 0)
            .map(ext => {
                return new EnergyRefillNeed(this.generator, this.room, {
                    extension: ext,
                    amount: extensionCapacity,
                })
            }) || []
    }
}

export class EnergyRefillNeed implements Need {
    roles: CreepRole[] = [CREEP_ROLE_HAULER];
    infinite: boolean = false;

    weight: 0.7

    extension: StructureExtension
    amount: number

    constructor(
        private generator: NeedGenerator,
        private room: RoomManager,
        {extension, amount}: {
            extension: StructureExtension,
            amount: number
        }) {
            this.extension = extension
            this.amount = amount
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

        return (actor.pos.getRangeTo(storeLocation) + storeLocation.getRangeTo(this.extension)) * this.weight
    }

}
